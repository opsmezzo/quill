/*
 * tar.js: Common utility functions for handling tarballs.
 *
 * (C) 2011, Isaac Schlueter
 * (C) 2012, Nodejitsu Inc. 
 * Adapted from `npm` under MIT. 
 *
 */

var tar = require('quill-tar'),
    quill = require('../../quill');
    
//
// ### function pack (tarball, dir, files, callback) 
// #### @tarball {string|Stream} Location of the tarball to create or stream to pipe to.
// #### @dir {string} Base directoty the tarball is being created from.
// #### @files {Array} List of files to include in the tarball
// #### @callback {function} Continuation to respond to when complete.
//
// Creates a tar+gzip stream for the specified `dir` and `files`. If `tarballs` is 
// a string then it is written to disk. If it is a stream then it will be piped to. 
//
exports.pack = function (tarball, dir, files, callback) {
  var emitter = tar.pack(tarball, dir, files, function (err) {
    if (err) {
      quill.log.error(err.log);
      quill.log.error(err.message);
    }
    
    callback(err);
  });
  
  //
  // Helper function for logging events from `quill-tar`.
  //
  function logEvent(ev) {
    emitter.on(ev, function (data) {
      var meta = {};
      meta[ev] = data;
      
      quill.log.verbose(ev, data);
    });
  }
  
  logEvent('tarball');
  logEvent('source');
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

  tar.unpack(tarball, target, options, function (err, target) {
    if (err) {
      quill.log.error(err.log);
      quill.log.error(err.message);
    }
    
    callback(err, target);
  })
  .on('untar-modes', function (modes) {
    quill.log.verbose('untar modes', modes);
  });
};