/*
 * common.js: Common utility functions for quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    flatiron = require('flatiron'),
    multimeter = require('multimeter'),
    quill = require('../../quill');

var common = module.exports = flatiron.common.mixin({}, flatiron.common);

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

//
// ### function meter (callback)
// #### @callback {function} Continuation to respond to.
// Responds with a `multimeter` instance if
//   * One does not already exist
//   * quill is running in in a TTY
//   * `raw` is not true.
//
common.meter = function (callback) {
  var multi;

  if (!quill.config.get('raw') && quill.config.get('progress') && process.stdout.isTTY) {
    multi = multimeter(process);
    multi.charm.cursor(false);
    return multi.drop({
      pad: true,
      type: 'stack',
      width: 20,
      empty: { text : ' ' },
      solid: {
        text: '|',
        foreground: 'white',
        background: 'blue'
      },
    }, function (stack) {
      multi.stack = stack;
      callback(multi);
    });
  }

  return callback();
};

//
// ### @ignoreFiles {Object}
// Named sets of default files ignored by quill.
//
common.ignore = {
  defaults: [''],
  scm:      [
    'CVS/',
    '.hg/',
    '.git/',
    '.svn/'
  ],
  nodejs:   ['npm-debug.log', '.lock-wscript'],
  osx:      ['.DS_Store'],
  vim:      [
    '.netrwhist',
    'Session.vim',
    '.*.sw[a-z]',
    '*.un~'
  ]
};