/*
 * remote.js: Composer functions for working with remote systems (i.e. `conservatory-api`) 
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var events = require('events'),
    fs = require('fs'),
    path = require('path'),
    composer = require('./index'),
    quill = require('../../quill'),
    common = quill.common,
    async = common.async;

//
// ### function package (dir, tarball, callback) 
// #### @dir {string} Directory to read the system from.
// #### @tarball {string|Stream} Location of the tarball to create or stream to pipe to.
// #### @callback {function} Continuation to respond to when complete.
//
// Creates a tarball package for the system located at the specified `dir`.
//
exports.package = function (dir, tarball, callback) {
  if (arguments.length === 1) {
    callback = dir;
    dir = process.cwd();
  }
  else if (arguments.length === 2) {
    callback = tarball;
    tarball = null;
  }
  
  var emitter = new events.EventEmitter();
  
  emitter.emit('read');
  composer.readJson(dir, function (err, pkg) {
    if (err) {
      return callback(err);
    }
    
    emitter.emit('list', pkg);
    composer.listFiles(dir, pkg, function (err, files) {
      if (err) {
        return callback(err);
      }
      
      tarball = tarball || path.join(process.cwd(), pkg.name + '.tgz');
      
      emitter.emit('pack', tarball);
      composer.pack(tarball, dir, files, callback);
    });
  });
  
  return emitter;
};

//
// ### function publish (system, tarball, callback) 
// #### @dir {string} Directory to read the system from.
// #### @callback {function} Continuation to respond to when complete.
//
// Publishes the `tarball` for the specified `system` to the registry 
// so that it can be installed by name.
//
exports.publish = function (system, tarball, callback) {
  //
  // Helper function which pipes `tarball` to the `quill.systems` client.
  // If tarball is a string, then a filestream will be created.
  //
  function uploadTarball(err) {
    if (err) {
      return callback(err);
    }
    
    var tarstream = typeof tarball === 'string'
      ? fs.createReadStream(tarball)
      : tarball;
      
    tarball.pipe(quill.systems.upload(system.name, system.version, callback));
  }
  
  if (typeof tarball !== 'string' && !tarball.on) {
    return callback(new Error('tarball must be a file or a stream.'));
  }
  
  quill.systems.update(system, uploadTarball);
};

//
// ### function download (systems, callback)
// #### @systems {Array|Object|string} List of systems to download to the target machine.
// #### @dir {string} **Optional** Directory to download files in.
// #### @callback {function} Continuation to respond to when complete.
//
// Downloads all systems in the runlist created from `systems`. If no `dir` is specified then
// `quill.config.get('directories:tmp')` will be used.
//
exports.download = function (systems, dir, callback) {
  if (!callback && typeof dir === 'function') {
    callback = dir;
    dir = quill.config.get('directories:tmp')
  }
  
  //
  // Downloads one system to the cache for quill.
  //
  function downloadOne(system, next) {
    system.tarball = common.tmpFile(dir, system.name, system.version, '.tgz');
        
    quill.systems.download(system.name, system.version, next)
      .pipe(fs.createWriteStream(system.tarball));
  }
  
  composer.runlist(systems, function (err, runlist) {
    if (err) {
      return callback(err);
    }
    
    runlist = runlist.map(function (system) {
      var parts = system.split('@');
      
      return {
        name: parts[0],
        version: parts[1]
      };
    });
    
    async.forEach(runlist, downloadOne, function (err) {
      return err ? callback(err) : callback(null, runlist);
    });
  });
};