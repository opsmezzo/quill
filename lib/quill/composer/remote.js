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

  quill.systems.get(system.name, function (err, existing) {
    if (err) {
      return err.status === '404' || err.status === 404
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
// #### @options {Object} Options for the download
// ####   @options.systems {Array|Object} List of systems to download to the target machine.
// ####   @options.dir     {string} **Optional** Directory to download files in.
// ####   @options.meter   {multimeter} CLI multimeter to display
// #### @callback {function} Continuation to respond to when complete.
//
// Downloads all `systems`. If no `dir` is specified then
// `quill.config.get('directories:tmp')` will be used.
//
exports.download = function (options, callback) {
  if (!options || !options.systems) {
    return callback(new Error('options.systems is required'));
  }

  var dir = options.dir || quill.config.get('directories:tmp');

  //
  // Downloads one system to the cache for quill.
  //
  function downloadOne(system, next) {
    var fetched = 0,
        downstream,
        bar;
    
    //
    // Create a temporary file for the system tarball and start the download.
    //
    system.tarball = common.tmpFile(dir, system.name, system.version, '.tgz');
    downstream     = quill.systems.download(system.name, system.version, next);

    //
    // If there is a meter then create a bar and process the data.
    //
    if (options.meter) {
      bar = options.meter.stack.push('fetch'.grey + ':   ' + system.name, 'bar');
      downstream.on('response', function (res) {
        length = res.headers['content-length'];
      });

      //
      // Update the bar on data
      //
      downstream.on('data', function (data) {
        fetched += data.length;
        bar.percent(
          ((fetched / length) * 100) | 0
        );
      });
    }

    downstream.pipe(fs.createWriteStream(system.tarball));
  }

  if (!Array.isArray(options.systems)) {
    options.systems = [options.systems];
  }

  async.forEach(options.systems, downloadOne, function (err) {
    return err ? callback(err) : callback(null, options.systems);
  });
};
