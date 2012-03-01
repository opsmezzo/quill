/*
 * lifecycle.js: Lifecycle methods (bootstrap, image, update, teardown) for systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var common = require('flatiron').common,
    async = common.async,
    composer = require('./index');

//
// ### function bootstrap (method, systems, callback)
// #### @systems {Array} Systems to run bootstrap lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `bootstrap` lifecycle method against the target `systems` 
// on the current machine.
//
exports.bootstrap = function (systems, callback) {
  exports.run('bootstrap', systems, callback);
};

//
// ### function image (method, systems, callback)
// #### @systems {Array} Systems to run image lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `image` lifecycle method against the target `systems` 
// on the current machine.
//
exports.image = function (systems, callback) {
  exports.run('image', systems, callback);
};

//
// ### function update (method, systems, callback)
// #### @systems {Array} Systems to run update lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `update` lifecycle method against the target `systems` 
// on the current machine.
//
exports.update = function (systems, callback) {
  exports.run('update', systems, callback);
};

//
// ### function teardown (method, systems, callback)
// #### @systems {Array} Systems to run teardown lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the `teardown` lifecycle method against the target `systems` 
// on the current machine.
//
exports.teardown = function (systems, callback) {
  exports.run('teardown', systems, callback);
};

//
// ### function run (method, systems, callback)
// #### @method {string} Name of the lifecycle script to execute.
// #### @systems {Array} Systems to run lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the lifecycle `method` against the target `systems` 
// on the current machine.
//
exports.run = function (method, systems, callback) {
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
// ### function runOne (method, systems, callback)
// #### @method {string} Name of the lifecycle script to execute.
// #### @system {string|Object} System to run lifecycle script for.
// #### @callback {function} Continuation to respond to when complete.
//
// Executes the lifecycle `method` against the target `system` 
// on the current machine.
//
exports.runOne = function (method, system, callback) {
  
};