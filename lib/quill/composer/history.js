/*
 * history.js: Manages lifecycle history for composer systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    fstream = require('fstream'),
    composer = require('./index'),
    quill = require('../../quill'),
    common = quill.common,
    async = common.async;

var history = exports;

//
// ### function read (system, callback)
// #### @system {string|Object} System (or name) to read history about. 
// #### @callback {function} Continuation to respond to when complete.
//
// Attempts to read the `history.json` for the specified `system`.
//
history.read = function (system, callback) {
  var systemDir = quill.common.installDir(system);
  
  fs.readFile(path.join(systemDir, 'history.json'), 'utf8', function (err, data) {
    if (err) {
      return err.code === 'ENOENT'
        ? callback(null, null)
        : callback(err)
    }
    
    try {
      data = JSON.parse(data);
    }
    catch (ex) {
      return callback(ex);
    }
    
    callback(null, data);
  });
};

//
// ### function save (system, callback)
// #### @system {string|Object} System (or name) to save history for. 
// #### @callback {function} Continuation to respond to when complete.
//
// Overwrites the `history.json` for the specified `system`.
//
history.save = function (system, callback) {
  var systemDir = quill.common.installDir(system);
  
  fs.writeFile(
    path.join(systemDir, 'history.json'), 
    JSON.stringify(system.history, null, 2),
    'utf8', 
    callback
  );
};

//
// ### function update (system, callback)
// #### @system {string|Object} System (or name) to update history. 
// #### @callback {function} Continuation to respond to when complete.
//
// Reads the existing `history.json` for the specified `system` and 
// merges it with `system.history` provided.
//
history.update = function (system, callback) {
  var systemDir = quill.common.installDir(system);
  
  history.read(system, function (err, history) {
    if (err) {
      return callback(err);
    }
    
    if (history) {
      common.mixin(system.history, history);
    }
    
    return history.save(system, callback);
  });
};