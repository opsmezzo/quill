/*
 * installed.js: Manages currently installed systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    fstream = require('fstream'),
    semver = require('semver'),
    composer = require('./index'),
    quill = require('../../quill'),
    common = quill.common,
    async = common.async;

//
// ### function add (systems, callback)
// #### @systems {Array} Systems to add to the install directory
// #### @callback {function} Continuation to respond to when complete
//
// Copies the specified systems from the cache to the install dir
// if the system is installed with a different version an error will be thrown.
//
exports.add = function (systems, callback) {
  async.map(systems, exports.addOne, callback);
};

//
// ### function add (system, callback)
// #### @system {Object} System to add to the install directory. Must specify `system.cached`.
// #### @callback {function} Continuation to respond to when complete
//
// Adds the specified system which has already been added to the local cache
// to the quill install directory for the current machine:
//
// 1. Check to see if the system is already installed.
//   * If it is and the versions do not match, respond with an error
// 2. Move the system into place
//
//    .quill/installed
//      /<system>
//        /<version>
//        /history.json
//
// 3. Update the history for the system
//
exports.addOne = function (system, callback) {
  var systemDir = quill.common.installDir(system),
      versionDir = path.join(systemDir, system.version);
  
  //
  // Helper function which checks for any existing
  // version of the system to install.
  //
  function checkInstalled(next) {
    exports.read(system, function (err, install) {
      if (install && install.history) {
        system.history = install.history;
      }
      
      if (err) {
        return err.code === 'ENOENT' 
          ? next()
          : callback(err);
      }
      else if (!install.system) {
        return next();
      }
      else if (semver.lt(system.version, install.system.version)) {
        return callback(null, install.system);
      }
      
      //
      // If a different version is installed respond
      // with an error.
      //
      if (system.version !== install.system.version) {
        //
        // TODO: Run uninstall for existing version.
        //
        return callback(new Error([
          'Cannot install',
          system.name,
          system.version, 
          'over existing version:',
          install.system.version
        ].join(' ')));
      }
      
      //
      // Otherwise this version is already installed so 
      // short-circuit and respond to the callback.
      //
      system.installed = versionDir;
      callback(null, system);
    });
  }
  
  async.series([
    //
    // 1. Attempt to read the system history.
    //   * If it does exist check the version and history
    //     before continuing
    //
    checkInstalled,
    //
    // 2. If it does not already exist, copy the system into place.
    //
    async.apply(common.mkdirp, versionDir),
    function copyVersion(next) {
      var responded;
      
      function done(err) {
        if (!responded) {
          responded = true;
          next(err);
        }
      }

      fstream.Reader({ type: 'Directory', path: system.cached })
        .on('error', done)
        .pipe(fstream.Writer({ type: 'Directory', path: versionDir }))
        .on('error', done)
        .on('end', done);
    },
    //
    // 3. Update the history for the system. 
    //
    function updateHistory(next) {
      var now = (new Date()).toISOString();
      
      //
      // Add the `copy` line item to the system history 
      // and update the `history.json` file
      //
      system.history = system.history || {};
      system.history[now] = {
        action: 'copy',
        version: system.version
      };
      
      composer.history.save(system, next);
    }
  ], function (err) {
    //
    // 4. Invoke the callback
    //
    system.installed = versionDir;
    return err ? callback(err) : callback(null, system);
  });
};

//
// ### function remove (systems, callback)
// #### @systems {string|Object|Array} Systems to remove from the cache
// #### @callback {function} Continuation to respond to when complete
// 
// Removes the specified `systems` from the install directory. 
//
exports.remove = function (systems, callback) {
  var installDir = quill.config.get('directories:install'),
      names = composer.dependencies.systemNames(systems);
  
  //
  // Helper function which removes a single version
  //
  function removeOne(name, next) {
    var systemDir = path.join(installDir, name);
    
    fs.readdir(systemDir, function (err, files) {
      if (err) {
        return err.code !== 'ENOENT'
          ? next(err)
          : next();
      }
      
      files = files.map(function (file) {
        return path.join(systemDir, file);
      });
      
      async.filter(files, common.isDirectory, function (dirs) {
        //
        // TODO: Check to see if there is more than one version installed.
        // TODO: Update versions
        //
        async.forEach(dirs, common.rimraf, next);
      });
    });
  }
  
  async.forEach(names.map(function (parts) {
    return parts[0];
  }), removeOne, callback);
};

//
// ### function list (callback)
// #### @callback {function} Continuation to respond to when complete
//
// Lists all systems and versions installed on the current machine.
//
exports.list = function (callback) {
  var installDir = quill.config.get('directories:install');
  
  //
  // Helper function which reads all `system.json` and
  // `history.json` files in parallel.
  //
  function readSystems(dirs) {
    if (!dirs || !dirs.length) {
      return callback(null, null);
    }

    async.parallel(dirs.reduce(function (systems, dir) {
      var system = path.basename(dir);
      systems[system] = exports.read.bind(null, system);
      return systems;
    }, {}), callback);
  }
  
  fs.readdir(installDir, function (err, dirs) {
    if (err) {
      return callback(err);
    }

    async.filter(dirs.map(function (dir) {
      return path.join(installDir, dir);
    }), common.isDirectory, readSystems);
  });
};

//
// ### function read (system, callback)
// #### @system {string|Object} System to read from the install directory.
// #### @callback {function} Continuation to respond to when complete.
//
// Attempts to read the `system` from the quill install directory.
//
exports.read = function (system, callback) {
  var systemDir = quill.common.installDir(system);
  
  //
  // Helper function which reads the `system.json` and 
  // `history.json` for the `system`.
  //
  function readVersion(dirs, next) {
    if (dirs.length > 1) {
      //
      // Remark: We should resolve against history here.
      //
      return callback(new Error('Too many versions installed: ' + dirs.length));
    }
    
    var versionDir = dirs[0];
    
    async.parallel({
      system: function tryRead(next) {
        composer.readJson(versionDir, function (err, pkg) {
          if (err) {
            return err.code === 'ENOENT'
              ? next(null, null)
              : next(err);
          }
          
          next(null, pkg);
        });
      },
      history: composer.history.read.bind(null, system)
    }, next);
  }
  
  async.waterfall([
    //
    // 1. List files in the `systemDir`
    //
    async.apply(fs.readdir, systemDir),
    //
    // 2. Filter for directories
    //
    function filterDirectories(files, next) {
      async.filter(files.map(function (file) {
        return path.join(systemDir, file);
      }), common.isDirectory, next.bind(null, null));
    },
    //
    // 3. Read `<system>/<version>/system.json` and
    //    `<system>/history.json`.
    //
    readVersion
  ], function (err, record) {
    //
    // 4. Invoke the callback with the error or install record.
    //
    return err ? callback(err) : callback(null, record);
  });
};

//
// ### function update (current, target, callback)
// #### @options {Object} Options for updating the target system
// ####   @options.name    {string} System to update.
// ####   @options.current {Object} Version to uninstall.
// ####   @options.target  {Object} Version to install.
// #### @callback {function} Continuation to respond to when complete.
//
// Uninstalls the `current` version of the `system` and installs
// the `target` version.
//
exports.update = function (options, callback) {
  async.waterfall([
    //
    // 1. Attach a meter if necessary
    //
    function getMeter(next) {
      common.meter(function (meter) {
        next(null, meter);
      });
    },
    //
    // 2. Add the system to the cache.
    //
    function cache(meter, next) {
      composer.cache.add({
        systems: [{
          name: options.name,
          version: options.target
        }],
        meter: meter
      }, next);
    },
    //
    // 3. Update the installed system by removing the old
    //    version.
    //
    function updateInstalled(cached, next) {
      exports.remove([options.name, options.current].join('@'), function (err) {
        return err ? next(err) : exports.add(cached, next);
      });
    }
  ], callback);
};

//
// ### function ensureLatest (system, callback)
// #### @system {Object} System to ensure latest for
// #### @callback {function} Continuation to respond to when complete.
// Ensures that the latest version of the specified `system` is installed.
//
exports.ensureLatest = function (system, callback) {
  quill.systems.get(system.name, function (err, latest) {
    if (err) {
      return callback(err);
    }
    else if (!semver.gt(latest.version, system.version)) {
      quill.log.info([system.name.magenta, system.version.yellow].join('@') + ' is latest.')
      return callback();
    }

    quill.log.info('Updating ' + system.name.magenta + ' to ' + latest.version.yellow);
    async.waterfall([
      function updateInstalled (next) {
        composer.installed.update({
          name:    system.name,
          current: system.version,
          target:  latest.version
        }, next);
      },
      //
      // 4. Copy over the new values: `cached`, etc.
      //
      function updateSystem(updated, next) {
        var update = updated[0];
        Object.keys(update).forEach(function (key) {
          system[key] = update[key];
        });

        next();
      }
    ], callback);
  });
};

//
// ### function ensureLatestDependencies (system, callback)
// #### @system {Object} System to ensure latest dependencies for.
// #### @callback {function} Continuation to respond to when complete.
// Ensures that if a newer version of the `system` depdendencies
// that satisfies parent dependencies are downloaded.
//
exports.ensureLatestDependencies = function (system, callback) {
  async.waterfall([
    async.apply(async.parallel, {
      //
      // 1. Get the set of all installed systems
      //
      installed: async.apply(composer.installed.list),
      //
      // 2. Get the maximum satisfying versions
      // for all dependencies in the target
      // system.
      //
      latest: async.apply(
        composer.dependencies.maxSatisfying,
        { system: system, client: quill.systems }
      )
    }),
    //
    // 3. If any of the maximum satisfying
    // versions are greater than those
    // installed update them.
    //
    function tryUpdate(result, next) {
      var installed = result.installed,
          latest    = result.latest,
          update;

      update = Object.keys(installed)
        .reduce(function (all, name) {
          if (semver.gt(latest[name], installed[name].version)) {
            all.push({
              name: name,
              current: installed[name].version,
              target: latest[name]
            });
          }

          return all;
        }, []);

      //
      // TODO: We should fail if update fails.
      //
      return update.length
        ? async.forEachSeries(update, exports.update, next)
        : next();
    }
  ], callback);
};