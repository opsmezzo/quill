/*
 * installed.js: Manages currently installed systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
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
// #### @system {Object} System to add to the install directory. Must specify `system.path`.
// #### @callback {function} Continuation to respond to when complete
//
// Adds the specified system which has already been added to the local cache
// to the quill install directory for the current machine:
//
// 1. Check to see if the system is already installed.
//   * If it is and the versions do not match, respond with an error
// 2. Move the system into place
//
//    .quill/install
//      /<system>
//        /<version>
//        /history.json
//
// 3. Update the history for the system
//
exports.addOne = function (system, callback) {
  var dir = quill.config.get('directories:install'),
      target;
  
  async.series([
     //
     // 1. Attempt to read the system history.
     //   * If it does not exist install normally.
     //   * If it does exist check the version and history
     //     before continuing
     //
     
     //
     // 2. If it does not already exist, copy the system into place.
     //
     
     //
     // 3. Update the history for the system. 
     //
   ], function (err) {
     //
     // 4. Invoke the callback
     //
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
      names = composer.systemNames(systems);
  
  //
  // Helper function which removes a single system.
  //
  function removeOne(dir, next) {
    //
    // TODO: Check the version of the `dir`.
    //
    if (!shouldRemove(dir)) {
      return next();
    }

    var fullpath = path.join(cacheDir, dir);
        
    fs.stat(fullpath, function (err, stat) {
      if (err) {
        return next(err);
      }
      else if (!stat.isDirectory()) {
        return next();
      }
      
      common.rimraf(fullpath, next);
    });
  }
  
  
  fs.readdir(installDir, function (err, dirs) {
    if (err) {
      return callback(err);
    }
        
    async.forEach(dirs, removeOne, callback);
  });
};

//
// ### function list (callback)
// #### @callback {function} Continuation to respond to when complete
//
// Lists all systems and versions in the cache.
//
exports.list = function (callback) {
  var installDir = quill.config.get('directories:install'),
      systems  = {};
  
  //
  // Helper function which lists the versions for the specified `dir`.
  //
  function readSystem(dir, next) {
    var fullpath = path.join(cacheDir, dir);
    
    fs.stat(fullpath, function (err, stat) {
      if (err) {
        return next(err);
      }
      else if (!stat.isDirectory()) {
        return next();
      }

      fs.readdir(fullpath, function (err, versions) {
        if (err) {
          return next(err);
        }

        systems[dir] = versions;
        next();
      });
    });
  }
  
  fs.readdir(installDir, function (err, dirs) {
    if (err) {
      return callback(err);
    }

    async.forEach(dirs, readSystem, function (err) {
      return err ? callback(err) : callback(null, systems);
    });
  });
};