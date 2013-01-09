/*
 * files.js: Composer functions for working with local system files (system.json, ignore files, etc).
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var events = require('events'),
    fs = require('fs'),
    path = require('path'),
    common = require('flatiron').common,
    async = common.async,
    composer = require('./index'),
    quill = require('../../quill');

//
// ### function readJson (dir, callback)
// #### @dir {string} Directory to read the system from.
// #### @callback {function} Continuation to respond to when complete.
//
// Reads the system located at the specified `dir` asynchronously.
//
exports.readJson = function (dir, callback) {
  if (!callback && typeof dir === 'function') {
    callback = dir;
    dir = process.cwd();
  }
  
  var pkg = {
    path: path.resolve(dir)
  };
  
  //
  // Remark: This is actually much harder than you would think.
  // See `/npm/lib/utils/read-json.js` and `/npm/lib/utils/load-package-defaults`.
  // We should eventually use that code. 
  //
  function readJson(next) {
    fs.readFile(path.join(dir, 'system.json'), 'utf8', function (err, system) {
      if (err) {
        return next(err);
      }
      
      try { system = JSON.parse(system); }
      catch (ex) { return next(ex); }
      
      Object.keys(system).forEach(function (key) {
        pkg[key] = system[key];
      });
            
      next();
    });
  }
  
  //
  // Helper function to load files from disk asychronously.
  //
  function loadResources(key, next) {
    var resourceDir = path.join(dir, key);
    
    fs.readdir(resourceDir, function (err, files) {
      if (err) {
        return err.code === 'ENOENT' ? next() : next(err);
      }
      
      pkg[key] = files.slice(0);
      next();
    });
  }
    
  async.parallel([
    readJson,
    loadResources.bind(null, 'files'),
    loadResources.bind(null, 'scripts'),
    loadResources.bind(null, 'templates')
  ], function (err) {
    return err ? callback(err) : callback(null, pkg);
  });
};