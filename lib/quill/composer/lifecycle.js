/*
 * lifecycle.js: Lifecycle methods (install, configure, update, uninstall) for systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    common = require('flatiron').common,
    async = common.async,
    composer = require('./index'),
    quill = require('../../quill');

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
// #### @runlist {Array} Systems to run teardown lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `uninstall` lifecycle script against the target `runlist` 
// on the current machine.
//
exports.uninstall = function (runlist, callback) {
  exports.run('teardown', runlist, callback);
};

//
// ### function run (script, runlist, callback)
// #### @script {string} Name of the lifecycle script to execute.
// #### @runlist {Array} Systems to run lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the lifecycle `script` against the target `runlist` 
// on the current machine.
//
exports.run = function (script, runlist, callback) {
  //
  // Helper function which runs a specified lifecycle `script`
  // on all necessary systems. 
  //
  function runAll(runlist) {
    async.forEachSeries(runlist, exports.runOne.bind(null, script, []), function (err) {
      return err
        ? callback(err)
        : callback(null, runlist);
    });
  }
  
  //
  // TODO: OS stuff here.
  //
  async.waterfall([
    async.apply(composer.cache.add, runlist),
    async.apply(composer.localizeRunlist),
    composer.installed.add,
    runAll
  ], callback);
};

//
// ### function runOne (script, args, system, callback)
// #### @script {string} Name of the lifecycle script to execute.
// #### @args {string[]} List of arguments to pass to the script.
// #### @system {string|Object} System to run lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the lifecycle `script` against the target `system` 
// on the current machine.
//
exports.runOne = function (script, args, system, callback) {
  var responded = false,
      target,
      child;
  
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
  // Read all the files from the system's `scripts` directory, fetch the 
  // target script and execute it. Pipe all `data` events to `quill.emit`.
  //
  fs.readdir(path.join(system.path, 'scripts'), function (err, files) {
    if (err) {
      return callback(err);
    }
    
    target = files.filter(function (file) {
      return file.replace(path.extname(file), '') === script;
    })[0];
    if (!target) {
      //
      // Remark: Should there be an error here?
      //
      return callback();
    }
    
    target = path.join(system.path, 'scripts', target);

    //
    // Remark: Need to ensure the script is executable.
    //
    
    //
    // Store the start time of the lifecycle operation
    //
    var start = (new Date()).toISOString();
    
    system.history = system.history || {};
    system.history[start] = {
      version: system.version,
      action: script,
      time: 'start'
    };
    
    //
    // TODO: Set environment variables and arguments 
    //       from system configuration
    //
    quill.log.info('Executing ' + target.magenta);
    quill.log.verbose('Arguments ' + args.green);
    child = spawn(target, args, {
      cwd: path.dirname(target)
    });
    
    function onExit(code) {
      //
      // TODO: Check `code` for proper result.
      //
      if (code) {
        var err = new Error('Lifecycle script '+JSON.stringify(script)+' exited with code: '+code);
        err.code = code;
        callback(err);
        return;
      }
      var end = (new Date()).toISOString();
      system.history[end] = {
        version: system.version,
        action: script,
        time: 'end'
      }
      
      composer.history.save(system, done);
    }
    
    //
    // Setup event handlers for the child process.
    //
    child.stdout.on('data', quill.emit.bind(quill, ['run', script, 'stdout'], system));
    child.stderr.on('data', quill.emit.bind(quill, ['run', script, 'stderr'], system));
    child.on('error', done);
    child.on('exit', onExit);
  });
};