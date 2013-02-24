/*
 * systems.js: Commands related to working with system configuration
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    archy = require('archy'),
    fstream = require('fstream'),
    semver = require('semver'),
    quill = require('../../quill'),
    async = require('flatiron').common.async,
    composer = quill.composer;

var systems = exports;

systems.usage = [
  '`quill systems *` commands allow you to run lifecycle scripts',
  'update and configure systems on target machines',
  '',
  'quill publish   <dir>',
  'quill unpublish <system>+',
  'quill pack      <dir>',
  '',
  'quill systems list',
  'quill systems publish   <dir>',
  'quill systems unpublish <system>+',
  'quill systems package   <dir>',
  'quill systems view      <system>',
  '',
  'quill systems bump [<release>]'
];

//
// Helper function which defines a shorthand alias for
// `quill systems lifecycle <script>` to `quill <script>`.
//
function lifecycleCommand(script) {
  //
  // Define the command as a pass-thru to `systems.lifecycle`.
  //
  systems[script] = function () {
    return systems.lifecycle.apply(
      null,
      [script].concat(Array.prototype.slice.call(arguments))
    );
  };

  //
  // Usage for `quill systems <script>`.
  //
  systems[script].usage = [
    'Runs the <script> lifecycle script for the specified `targets`',
    'on the current machine.',
    '',
    'quill <script>         <system>+',
    'quill systems <script> <system>+'
  ].map(function (line) {
    return line.replace('<script>', script);
  });
}

//
// Define commands for the core lifecycle scripts:
// `install, configure, update, uninstall`.
//
var lifecycle = [
  'install',
  'configure',
  'start',
  'update',
  'uninstall'
];

lifecycle.forEach(lifecycleCommand);

//
// ### function lifecycle (script, targets, ...callback)
// #### @script {string} Name of the lifecycle script to run.
// #### @targets {Array} List of systems to run the lifecycle `script` on.
// #### @callback {function} Continuation to respond to when complete.
//
// Runs the lifecycle `script` for the specified `targets` on the current machine.
//
systems.lifecycle = function (script) {
  var systems = Array.prototype.slice.call(arguments, 1),
      callback = systems.pop(),
      lastLine = '';

  if (lifecycle.indexOf(script) === -1) {
    return callback(new Error([
      'Invalid action:',
      script.magenta + '.',
      'Valid actions are:',
      lifecycle.join(' ').yellow + '.'
    ].join(' ')), true);
  }

  quill.log.info('Executing lifecycle action ' + script.yellow);

  //
  // Helper function which outputs the results from the
  // lifecycle script on all systems.
  //
  function onData(system, data) {
    data = '' + data;
    data.split('\n').forEach(function (line) {
      line = line.trim();
      if ((!line || !line.length)
          && (lastLine || lastLine.length)) {
        lastLine = line;
        return;
      }

      quill.log.data(line);
    });
  }

  quill.on(['run', 'stdout'], onData);
  quill.on(['run', 'stderr'], onData);

  composer[script](systems, function (err) {
    quill.off(['run', 'stdout'], onData);
    quill.off(['run', 'stderr'], onData);
    return callback(err);
  });
};

//
// Usage for `quill systems lifecycle`.
//
systems.lifecycle.usage = [
  'Runs an arbitrary lifecycle script for the specified `targets`',
  'on the current machine.',
  '',
  'quill systems lifecycle <name> <system>+'
];

//
// ### function publish (target, callback)
// #### @target {string} **Optional** Directory or tarball to publish system from.
// #### @callback {function} Continuation to respond to when complete.
// Publishes the target `dir` to the registry so that it can be installed by name.
//
systems.publish = function (target, callback) {
  var responded;

  target = target || process.cwd();
  target = path.resolve(target);

  //
  // Helper function for responding to `end` or
  // `error` events on streams.
  //
  function respond(err) {
    if (!responded) {
      responded = true;
      callback(err);
    }
  }

  //
  // Helper function for bumping current system version.
  //
  function tryBump(dir, next) {
    if (!quill.argv.bump) {
      return next();
    }

    if (typeof quill.argv.bump === 'boolean') {
      quill.argv.bump = typeof quill.config.get('bump') === 'string'
        ? quill.config.get('bump')
        : 'patch';
    }

    systems.bump(quill.argv.bump, dir, next);
  }

  //
  // Helper function to publish a given directory
  //
  function publishDir(dir, next) {
    tryBump(dir, function (err) {
      if (err) {
        return next(err);
      }

      quill.log.info('Reading system.json in ' + dir.yellow);
      composer.readJson(dir, function (err, system) {
        if (err) {
          return next(err);
        }

        var name = [system.name, system.version].join('@').magenta;
        quill.log.info('Packaging system: ' + name);

        //
        // Remark: This could be cleaned if we could pipe a multi-part
        // stream to conservatory.
        //
        composer.pack(dir)
          .pipe(composer.publish(system))
          .on('upload:start', function () {
            quill.log.info('Publishing system: ' + name);
          })
          .on('error', respond)
          .on('upload:end', respond);
      });
    });
  }

  //
  // Helper function to publish all systems within a
  // given directory
  //
  function publishDirRecursive() {
    fs.readdir(target, function (err, files) {
      if (err) {
        return callback(err);
      }

      //
      // Create a map of all files to fs.stat
      // information.
      //
      async.map(
        files.map(function (file) {
          return path.join(target, file);
        }),
        function mapStats(file, next) {
          fs.stat(file, function (err, stats) {
            return !err
              ? next(null, { file: file, stats: stats })
              : next(err);
          });
        },
        function (err, results) {
          if (err) {
            return callback(err);
          }

          //
          // Publish each directory ignoring
          // regular files.
          //
          async.forEach(
            results.filter(function (r) {
              return r.stats.isDirectory();
            }).map(function (r) {
              return r.file;
            }),
            function (dir, next) {
              publishDir(dir, next)
            },
            callback
          );
        }
      );
    });
  }

  fs.stat(target, function (err, stats) {
    if (err) {
      return callback(err);
    }
    else if (stats.isDirectory()) {
      return !(quill.argv.r || quill.argv.recursive)
        ? publishDir(target, callback)
        : publishDirRecursive();
    }

    //
    // TODO: Add capability to publish from tarball
    //
    return callback(new Error('Not implemented'));
  });
};

//
// Usage for `quill systems publish`.
//
systems.publish.usage = [
  'Publishes a package to the registry so that it can be installed by name.',
  '',
  'quill publish <tarball|folder>',
  'quill systems publish <tarball|folder>'
];

//
// ### function unpublish (system+, callback)
// #### @system+ {string} System(s) to unpublish.
// #### @callback {function} Continuation to respond to.
//
// Unpublishes system(s).
//
systems.unpublish = function () {
  var args = Array.apply(null, arguments),
      callback = args.pop();

  if (args.length === 0) {
    return callback(new Error('At least one system name is required'), true);
  }

  async.forEach(
    args,
    quill.systems.destroy.bind(quill.systems),
    callback
  );
};

//
// Usage for `quill unpublish`.
//
systems.unpublish.usage = [
  'Unpublishes systems.',
  '',
  'quill unpublish <system>+',
  'quill systems unpublish <system>+'
];

//
// ### function pack (dir, callback)
// #### @dir {string} **Optional** Directory to pack files from
// #### @callback {function} Continuation to respond to when complete.
// Packages the target `dir` into a tarball ready for publication
//
systems.pack = function (dir, callback) {
  dir = dir || process.cwd();
  dir = path.resolve(dir);

  var responded;

  //
  // Helper function for responding to `end` or
  // `error` events on streams.
  //
  function respond(err) {
    if (!responded) {
      responded = true;
      callback(err);
    }
  }

  quill.log.info('Reading system.json in ' + dir.yellow);
  composer.readJson(dir, function (err, system) {
    if (err) {
      return callback(err);
    }

    var target = path.join(
      process.cwd(),
      [system.name, system.version].join('-') + '.tgz'
    );

    quill.log.info('Packaging system into ' + target.yellow);
    composer.pack(dir)
      .on('error', respond)
      .pipe(fstream.Writer({ type: 'File', path: target }))
      .on('error', respond)
      .on('close', respond);
  });
};

//
// Usage for `quill systems pack`.
//
systems.pack.usage = [
  'Packages the target directory into a tarball ready for publication',
  '',
  'quill pack <dir>',
  'quill systems pack <dir>'
];

//
// ### function list (callback)
// #### @callback {function} Continuation to respond to when complete.
// Lists all systems in the registry.
//
systems.list = function (callback) {
  quill.systems.list(function (err, systems) {
    if (err) {
      return callback(err);
    }

    var rows = [['name', 'latest', 'description']],
        colors = ['underline', 'yellow', 'grey'];

    systems.forEach(function (system) {
      rows.push([
        system.name,
        semver.maxSatisfying(Object.keys(system.versions), '*'),
        system.description
      ]);
    });

    quill.inspect.putRows('data', rows, colors);
    callback(null, systems);
  });
};

//
// Usage for `quill systems list`.
//
systems.list.usage = [
  'Lists all systems in the registry.',
  '',
  'quill list',
  'quill systems list'
];

//
// ### function list (name, callback)
// #### @name {string} Name of the system to view.
// #### @callback {function} Continuation to respond to when complete.
//
// Views details for the system with the specified `name`.
//
// TODO: Parse additional arguments. e.g. `name@version`.
//
systems.view = function (name, callback) {
  if (!name) {
    return callback(new Error('Name is required.'), true);
  }

  quill.systems.get(name, function (err, system) {
    if (err) {
      return callback(err);
    }

    //
    // TODO: Format the system object.
    //
    quill.inspect.putObject(system);
    callback();
  });
};

//
// Usage for `quill systems view`.
//
systems.view.usage = [
  'Views details for the system with the specified <name>.',
  '',
  'quill view <name>',
  'quill systems view <name>'
];

//
// ### function view (release, callback)
// #### @release {string} Release type. Defaults to "patch".
// #### @callback {function} Continuation to respond to when complete.
//
// Bump system version in the current directory.
//
systems.bump = function (release, dir, callback) {
  release = release || quill.config.get('bump') || 'patch';
  dir     = dir ? path.resolve(dir) : process.cwd();

  //
  // Use `fs` functions instead of `composer.readJson` due to changes in the
  // `system.json` introduced by `readJson`.
  //
  var systemJson = path.join(dir, 'system.json');

  quill.log.info('Reading system.json in ' + dir.yellow);
  fs.readFile(systemJson, 'utf8', function (err, data) {
    if (err) {
      return callback(err);
    }

    var oldVersion;

    try {
      data = JSON.parse(data);
    }
    catch (ex) {
      return callback(ex);
    }

    oldVersion = data.version;
    data.version = semver.inc(data.version, release);
    quill.log.info('Version ' + oldVersion.grey + ' bumped to ' + data.version.grey);
    fs.writeFile(systemJson, JSON.stringify(data, null, 2), 'utf8', callback);
  });
};

//
// Usage for `quill systems bump`.
//
systems.bump.usage = [
  'Bumps version string for the system in the current directory.',
  'Possible values for `<release>` are: "major", "minor", "patch" and "build".',
  'Default value is "patch".',
  '',
  'quill systems bump [<release>]',
];

//
// ### function installed (callback)
// #### @callback {function} Continuation to respond to.
// Lists all systems installed on the current machine.
//
systems.installed = function (callback) {
  composer.installed.list(function (err, list) {
    if (err) {
      return callback(err);
    }

    var names = Object.keys(list);

    if (!names || !names.length) {
      quill.log.warn('No systems installed');
    }
    else {
      archy(composer.hierarchy(
        quill.config.get('directories:install'),
        names.reduce(function (systems, name) {
          systems[name] = list[name].system;
          return systems;
        }, {})
      ))
      .split('\n')
      .filter(Boolean)
      .forEach(function (line) {
        quill.log.data(line);
      });
    }

    callback();
  });
};

//
// Usage for `quill systems installed`.
//
systems.installed.usage = [
  'Lists all systems installed on the current machine.',
  '',
  'quill systems installed',
  'quill installed'
];

systems.latest = function (name, callback) {
  quill.log.info('Latest versions that satisfy all semver requirements.');
  composer.maxSatisfying(name, function (err, latest) {
    if (err) {
      return callback(err);
    }

    quill.inspect.putObject(latest);
    callback(null, latest);
  });
}