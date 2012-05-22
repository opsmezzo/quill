/*
 * common.js: Common utility functions for quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    flatiron = require('flatiron'),
    quill = require('../../quill');

var common = module.exports = flatiron.common.clone(flatiron.common);

common.authorizedKeys = require('./authorized-keys');

//
// ### function remkdirp (dir, callback) 
// #### @dir {string} Directory to recreate
// #### @callback {function} Continuation to respond to when complete.
//
// Recreates the `dir` by removing it (`rimraf`) and recreating it (`mkdirp`).
//
common.remkdirp = function (dir, callback) {
  common.async.series([
    function tryRimraf(next) {
      common.rimraf(dir, function (err) {
        return err && err.code !== 'ENOENT'
          ? next(err)
          : next();
      })
    },
    common.async.apply(common.mkdirp, dir)
  ], callback);
};

//
// ### function isDirectory (file, callback)
//
// Async filter function which checks if a given 
// `file` is a directory.
//
common.isDirectory = function (file, callback) {
  fs.stat(file, function (err, stat) {
    return !err
      ? callback(stat.isDirectory())
      : callback(false);
  });
};

//
// ### function tmpFile (dir, name, version, ext)
// #### @dir {string} Directory to place the temp file in
// #### @name {string} Name of the system
// #### @version {string} Version of the system
// #### @ext {string} **Optional** File extention of the temp file
//
// Returns a path for a unique temporary file for the system represented
// by `name` and `version`. 
//
common.tmpFile = function (dir, name, version, ext) {
  ext = ext || '';
  return path.join(dir, ['__quill', name, version, Date.now() + ext].join('-'));
};

//
// ### function installDir (system)
// #### @system {string|Object} System to get the install dir for
//
// Returns the root installation directory for the specified `system`. 
//
common.installDir = function (system) {
  if (typeof system === 'string') {
    system = { name: system };
  }
  
  return path.join(
    quill.config.get('directories:install'), 
    system.name
  ); 
};