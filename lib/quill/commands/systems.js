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
    BufferedStream = require('union').BufferedStream,
    quill = require('../../quill'),
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
  'quill systems view      <system>'
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
  'update',
  'uninstall'
];

lifecycleCommand('install');
lifecycleCommand('configure');
lifecycleCommand('update');
lifecycleCommand('uninstall');

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
      callback = systems.pop();

  if (lifecycle.indexOf(script) === -1) {
    return callback(new Error([
      'Invalid action:',
      script.magenta + '.',
      'Valid actions are:',
      lifecycle.join(' ').yellow + '.'
    ].join(' ')), true, true);
  }

  quill.log.info('Executing lifecycle action ' + script.yellow);
  
  //
  // Helper function which outputs the results from the 
  // lifecycle script on all systems.
  //
  function onStdout(system, data) {
    data = '' + data;
    data.split('\n').forEach(function (line) {
      quill.log.data(line);
    });
  }
  
  quill.on(['run', script, 'stdout'], onStdout);
  
  composer[script](systems, function (err) {
    quill.off(['run', script, 'stdout'], onStdout);
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
  target = target || process.cwd();
  target = path.resolve(target);
  
  //
  // Helper function to publish a given directory
  //
  function publishDir() {
    var stream = new BufferedStream(),
        emitter,
        system;
    
    emitter = composer.package(target, stream, function (err) {
      composer.publish(system, stream, callback);
    });
    
    emitter.on('list', function (json) {
      system = json;
    });
  }
  
  fs.stat(target, function (err, stats) {
    if (err) {
      return callback(err);
    }
    else if (stats.isDirectory()) {
      return publishDir();
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
// ### function pack (dir, callback)
// #### @dir {string} **Optional** Directory to pack files from
// #### @callback {function} Continuation to respond to when complete.
// Packages the target `dir` into a tarball ready for publication
//
systems.pack = function (dir, callback) {
  dir = dir || process.cwd();
  dir = path.resolve(dir);
  
  composer.package(dir, callback).on('read', function () {
    quill.log.info('Reading system.json in ' + dir.yellow);
  }).on('list', function (pkg) {
    quill.log.info('Listing system files for package:');
    quill.inspect.putObject(pkg);
  }).on('pack', function (target) {
    quill.log.info('Packaging system into ' + target.yellow);
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
  quill.log.warn('not implemented');
  callback(new Error(), true, true);
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
    return callback(new Error('Name is required.'), true, true);
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