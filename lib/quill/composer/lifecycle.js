/*
 * lifecycle.js: Lifecycle methods (install, configure, update, uninstall) for systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    os = require('os'),
    wtfos = require('wtfos'),
    common = require('flatiron').common,
    async = common.async,
    composer = require('./index'),
    quill = require('../../quill');

//
// ### @orderings {Object}
// Ordering of lifecycle-actions
//
exports.orderings = {
  install:   null,
  uninstall: null,
  configure: ['install'],
  update:    ['install', 'configure'],
  start:     ['install', 'configure']
};

//
// ### @private sortScript (scripts)
// Returns scripts based on custom sort-ordering
// for lifecycle actions.
//
// TODO: Not make this so massively inefficient.
//
function sortScripts(scripts) {
  var has = {
    updateOrStart: scripts.filter(function (script) {
      return /^(update|start)/.test(script);
    }),
    configure: scripts.filter(function (script) {
      return /^configure/.test(script);
    })
  };

  if (has.updateOrStart.length) {
    return [
      /^install/,
      /^configure/,
      /^(update|start)/
    ].map(function (re) {
      return scripts
        .filter(function (s) { return re.test(s); })[0];
    }).filter(Boolean);
  }
  else if (has.configure.length) {
    return [
      /^install/,
      /^configure/
    ].map(function (re) {
      return scripts
        .filter(function (s) { return re.test(s); })[0];
    }).filter(Boolean);
  }

  return scripts;
};

//
// ### function install (runlist, callback)
// #### @runlist {Array} Systems to run install lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `install` lifecycle script against the target `runlist`
// on the current machine.
//
exports.install = function (runlist, callback) {
  exports.run('install', runlist, callback);
};

//
// ### function configure (runlist, callback)
// #### @runlist {Array} Systems to run configure lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `configure` lifecycle script against the target `runlist`
// on the current machine.
//
exports.configure = function (runlist, callback) {
  exports.run('configure', runlist, callback);
};

//
// ### function start (runlist, callback)
// #### @runlist {Array} Systems to run start lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `start` lifecycle script against the target `runlist`
// on the current machine.
//
exports.start = function (runlist, callback) {
  exports.run('start', runlist, callback);
};

//
// ### function update (runlist, callback)
// #### @runlist {Array} Systems to run update lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `update` lifecycle script against the target `runlist`
// on the current machine.
//
exports.update = function (runlist, callback) {
  exports.run('update', runlist, callback);
};

//
// ### function uninstall (runlist, callback)
// #### @runlist {Array} Systems to run uninstall lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `uninstall` lifecycle script against the target `runlist`
// on the current machine.
//
exports.uninstall = function (runlist, callback) {
  exports.run('uninstall', runlist, callback);
};

//
// ### function run (action, runlist, callback)
// #### @action {string} Name of the lifecycle script to execute.
// #### @runlist {Array} Systems to run lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the lifecycle `action` against the target `runlist`
// on the current machine.
//
exports.run = function (action, runlist, callback) {
  var installed;

  //
  // Helper function which runs a specified lifecycle `action`
  // on all necessary systems.
  //
  function runAll(runlist) {
    async.forEachSeries(runlist, exports.runScripts.bind(null, action), function (err) {
      return err
        ? callback(err)
        : callback(null, runlist);
    });
  }

  //
  // ### function installSystems(systems)
  // Adds all of the necessary systems to the quill installed
  // directory.
  //
  function installSystems(systems) {
    async.waterfall([
      async.apply(composer.installed.list),
      function maybeLocalizeRunlist(installed_, next) {
        installed = installed_;

        return /^install/.test(action) && quill.argv.force
          ? next(null, systems)
          : next(null, composer.localizeRunlist(systems, installed));
      },
      composer.installed.add
    ], function (err) {
      return !err
        ? runAll(composer.expandRunlist(action, systems, installed))
        : callback(err);
    });
  }

  //
  // ### function cacheSystems()
  // Adds all of the necessary systems to the quill cache
  // directory.
  //
  function cacheSystems() {
    async.waterfall([
      wtfos,
      function (os, callback) {
        return callback(null, {
          systems: runlist,
          os: (os.distribution && os.distribution.toLowerCase()) || null
        });
      },
      composer.cache.add
    ], function (err, systems) {
      return err
        ? callback(err)
        : installSystems(systems)
    });
  }

  if (/^install/.test(action) && quill.argv.force) {
    //
    // Special case: when we're installing system which is already installed,
    // run uninstall script for the installed version first.
    //
    return composer.installed.list(function (err, installed) {
      if (err || !installed) {
        return cacheSystems();
      }

      async.forEachSeries(Object.keys(installed), function (name, next) {
        if (!~runlist.indexOf(name)) {
          return next();
        }

        var system = installed[name].system,
            uninstall;

        uninstall = system.scripts && system.scripts.filter(function (script) {
          return /^uninstall/.test(script);
        })[0];

        if (!uninstall) {
          return next();
        }

        composer.config.getConfig(system, function (err, config) {
          //
          // Remark: what to do when `uninstall` script fails? Ignore and continue
          // or stop?
          //
          exports.runOne(uninstall, system, config, next);
        });
      }, function () {
        composer.installed.remove(runlist, cacheSystems);
      });
    });
  }

  cacheSystems();
};

//
// ### function runScripts (action, system, callback)
// #### @action {string} Name of the lifecycle script to execute.
// #### @system {Object} System to run lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes all lifecycle `scripts` in `system.scripts` due to the target
// action being run against the `system` on the current machine.
//
exports.runScripts = function (action, system, callback) {
  //
  // If there are no scripts in `system.scripts` then skip this
  // system.
  //
  if (!Array.isArray(system.scripts) || !system.scripts.length) {
    quill.log.warn('No scripts found for: ' + system.name.magenta + ' ' + action);
    return callback();
  }

  //
  // Get the configuration for the specified system and then
  // run all scripts in `system.scripts`.
  //
  composer.config.getConfig(system, function (err, config) {
    if (err) {
      return callback(err, true, true);
    }

    async.forEachSeries(
      sortScripts(system.scripts),
      function run(script, next) {
        exports.runOne(script, system, config, next);
      },
      callback
    );
  }).on('fetch', function (name) {
    quill.log.info('Fetching remote config: ' + name.yellow);
  });
};

//
// ### function runOne (script, system, config, callback)
// #### @script {string} Script to execute for the system.
// #### @system {Object} System to run lifecycle script for.
// #### @config {Object} Configuration to use when running the script.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the lifecycle `script` for the target `system` using
// the given `config` on the current machine.
//
exports.runOne = function (script, system, config, callback) {
  var responded = false,
      child;

  //
  // ### function run(err)
  // Helper function which executes the specified script
  // for the system.
  //
  function run(err) {
    if (err) {
      return callback(err);
    }

    //
    // `system.path` can sometimes be set to the config dir when
    // an update is being done; accomodate that
    //
    system.path = system.path.replace(/\/cache/, '/installed')
                             .replace(/\/system$/, '');

    var target = path.join(system.path, 'scripts', script),
        action = path.basename(script, path.extname(script));

    //
    // Read all the files from the system's `scripts` directory, fetch the
    // target script and execute it. Pipe all `data` events to `quill.emit`.
    //
    fs.stat(target, function (err, stats) {
      if (err) {
        return err.code !== 'ENOENT'
          ? callback(err)
          : callback();
      }

      var disabled = quill.config.get('lifecycle:disabled'),
          mode = (stats.mode & parseInt('777', 8)).toString(8);

      //
      // If we are on a disabled platform skip running the script.
      //
      if (os.platform() === disabled) {
        quill.log.warn('Lifecycle actions disabled on ' + disabled.yellow);
        return callback();
      }

      //
      // TODO: Make this more robust so it is not world-executable.
      //
      fs.chmod(target, mode.replace(/(\d{2})(\d)/, '$17'), function (err) {
        if (err) {
          return callback(err);
        }

        //
        // Store the start time of the lifecycle operation
        //
        var start = (new Date()).toISOString(),
            env = composer.config.toEnvironment(config);

        system.history = system.history || {};
        system.history[start] = {
          version: system.version,
          action: action,
          time: 'start'
        };

        Object.keys(process.env).forEach(function (key) {
          env[key] = process.env[key];
        });

        if (quill.config.get('dry')) {
          quill.log.warn('Skipping ' + target.magenta);
          return done();
        }

        quill.log.info('Executing ' + target.magenta);
        child = spawn(target, [], {
          env: env,
          cwd: path.dirname(target)
        });

        //
        // Setup event handlers for the child process.
        //
        child.stdout.on('data', quill.emit.bind(quill, ['run', 'stdout'], system));
        child.stderr.on('data', quill.emit.bind(quill, ['run', 'stderr'], system));
        child.on('error', done);
        child.on('exit', function (code) {
          //
          // TODO: Check `code` for proper result.
          //
          var end = (new Date()).toISOString();
          system.history[end] = {
            version: system.version,
            action: action,
            time: 'end'
          };

          composer.history.save(system, done);
        });
      });
    });
  }

  //
  // Called when `child` emits `error` or `exit`.
  //
  function done(err) {
    if (responded) {
      return;
    }

    if (child) {
      child.stdout.removeAllListeners('data');
      child.stderr.removeAllListeners('data');
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
    }

    responded = true;
    return err
      ? callback(err)
      : callback(null);
  }

  //
  // If the `script` is not "configure" then just
  // run the script.
  //
  if (!/^configure/.test(script) || quill.config.get('template') === false) {
    return run();
  }

  //
  // Template all system's files then run the script.
  //
  composer.template.dir({
    dir: path.join(system.path, 'templates'),
    config: config,
    force: quill.argv.force
  }, run)
    .on('file', function (file) {
      quill.log.info('Templating file: ' + file.yellow);
    });
};
