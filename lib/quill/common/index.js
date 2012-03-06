/*
 * common.js: Common utility functions for quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var path = require('path'),
    flatiron = require('flatiron');

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

common.tmpFile = function (dir, name, version, ext) {
  ext = ext || '';
  return path.join(dir, ['__quill', name, version, Date.now() + ext].join('-'));
};