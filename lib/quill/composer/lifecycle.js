/*
 * lifecycle.js: Lifecycle methods (bootstrap, image, update, teardown) for systems.
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
// ### function bootstrap (runlist, callback)
// #### @runlist {Array} Systems to run bootstrap lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `bootstrap` lifecycle script against the target `runlist` 
// on the current machine.
//
exports.bootstrap = function (runlist, callback) {
  exports.run('bootstrap', runlist, callback);
};

//
// ### function image (runlist, callback)
// #### @runlist {Array} Systems to run image lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `image` lifecycle script against the target `runlist` 
// on the current machine.
//
exports.image = function (runlist, callback) {
  exports.run('image', runlist, callback);
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
// ### function teardown (runlist, callback)
// #### @runlist {Array} Systems to run teardown lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `teardown` lifecycle script against the target `runlist` 
// on the current machine.
//
exports.teardown = function (runlist, callback) {
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
  // TODO: OS stuff here.
  //
  
  function runAll(runlist) {
    async.forEachSeries(runlist, composer.runOne, function (err) {
      return err
        ? callback(err)
        : callback(null, runlist);
    });
  }
   
  composer.cache.add(runlist, function (err) {
    return err
      ? callback(err)
      : runAll(runlist);
  });
};

//
// ### function runOne (script, system, callback)
// #### @script {string} Name of the lifecycle script to execute.
// #### @system {string|Object} System to run lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the lifecycle `script` against the target `system` 
// on the current machine.
//
exports.runOne = function (script, system, callback) {
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
    // TODO: Set environment variables and arguments 
    //       from system configuration
    // 
    //
    child = spawn(target);
    
    //
    // Setup event handlers for the child process.
    //
    child.stdout.on('data', quill.emit.bind(quill, ['run', script, 'stdout']));
    child.stderr.on('data', quill.emit.bind(quill, ['run', script, 'stderr']));
    child.on('error', done);
    child.on('exit', function (code) {
      //
      // TODO: Check `code` for proper result.
      //
      done();
    });
  });
};