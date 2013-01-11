/*
 * remote.js: Composer functions for working with remote systems (i.e. `conservatory-api`) 
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var events = require('events'),
    fs = require('fs'),
    path = require('path'),
    BufferedStream = require('union').BufferedStream,
    composer = require('./index'),
    quill = require('../../quill'),
    common = quill.common,
    async = common.async;

//
// ### function publish (system, callback) 
// #### @system {Object} System to publish.
// #### @callback {function} Continuation to respond to when complete.
//
// Returns a BufferedStream which can be immediately piped to to publish 
// the specified `system` to the registry so that it can be installed by name.
//
exports.publish = function (system) {
  var tarball = new BufferedStream();

  //
  // Helper function which pipes `tarball` to the `quill.systems` client.
  // If tarball is a string, then a filestream will be created.
  //
  function uploadTarball(err) {
    if (err) {
      return tarball.emit('error', err);
    }

    tarball.emit('upload:start');
    tarball.pipe(quill.systems.upload(system.name, system.version, function (err) {
      return err
        ? tarball.emit('error', err)
        : tarball.emit('upload:end');
    }));
  }
  
  //
  // Delete `path` on the system so it does not cruft things up.
  //
  delete system.path;

  quill.systems.get(system.name, function (err, existing) {
    if (err) {
      return err.result && (err.result.status === 404)
        ? quill.systems.create(system, uploadTarball)
        : tarball.emit('error', err);
    }
    
    //
    // TODO: Check existing version and whatnot.
    //
    quill.systems.addVersion(system, uploadTarball);
  });

  return tarball;
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
exports.download = function (options, callback) {
  var dir = options.dir || quill.config.get('directories:tmp');

  //
  // Downloads one system to the cache for quill.
  //
  function downloadOne(system, next) {
    system.tarball = common.tmpFile(dir, system.name, system.version, '.tgz');
    
    quill.systems.download(system.name, system.version, next)
      .pipe(fs.createWriteStream(system.tarball));
  }

  composer.runlist(options, function (err, runlist) {
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
