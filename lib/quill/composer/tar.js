/*
 * tar.js: Common utility functions for handling tarballs.
 *
 * (C) 2011, Isaac Schlueter
 * (C) 2012, Nodejitsu Inc. 
 * Adapted from `npm` under MIT. 
 *
 */

var tar = require('quill-tar'),
    quill = require('../../quill'),
    common = quill.common;
    
//
// ### function pack (tarball, dir, files, callback) 
// #### @dir {Object} Directory to package into a system tarball
//
// Returns a new tar+gzip stream for the specified `dir`.
//
exports.pack = function (dir) {
  return tar.pack({
    dir: dir,
    ignoreRules: common.ignore
  });
};

//
// ### function untar (tarball, target, options, callback)
// #### @tarball {string} Path to the tarball to untar.
// #### @target {string} Parent directory to untar into
// #### @options {Object} Options for untaring
// #### @callback {function} Continuation to respond to when complete
//
// Executes an `untar` operation on the specified `tarball` and places it 
// in the `target` directory.
//
exports.unpack = function (tarball, target, options, callback) {
  options             = options             || {};
  options.modes       = options.modes       || {};
  options.modes.exec  = options.modes.exec  || quill.config.get('modes:exec');
  options.modes.file  = options.modes.file  || quill.config.get('modes:file');
  options.modes.umask = options.modes.umask || quill.config.get('modes:umask');

  quill.log.verbose('untar modes', options.modes);
  tar.unpack(tarball, target, options, callback);
};