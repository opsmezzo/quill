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
  '`quill systems *` commands allow you to install, update',
  'and configure systems on target machines',
  '',
  'quill install <system>+',
  'quill publish <dir>',
  'quill pack    <dir>',
  '',
  'quill systems list',
  'quill systems install <system>+',
  'quill systems publish <dir>',
  'quill systems package <dir>',
  'quill systems view    <system>'
];

//
// ### function install (targets, ...callback)
// #### @targets {Array} List of systems to install.
// #### @callback {function} Continuation to respond to when complete.
// Installs the specified `targets` on the current machine.
//
systems.install = function () {
  var targets = Array.prototype.slice.call(arguments),
      callback = targets.pop();

  quill.log.warn('not implemented');
  callback(new Error(), true, true);
};

//
// Usage for `quill systems install`.
//
systems.install.usage = [
  'Installs the specified `targets` on the current machine.',
  '',
  'quill install <system>+',
  'quill systems install <system>+'
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
// Views details for the system with the specified `name`.
//
systems.view = function (name, callback) {
  if (!name) {
    return callback(new Error('Name is required.'));
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