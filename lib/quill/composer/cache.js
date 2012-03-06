/*
 * cache.js: Cache of systems on the current machine.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    composer = require('./index'),
    quill = require('../../quill'),
    common = quill.common,
    async = common.async;

//
// ### function add (systems, callback)
// #### @systems {string|Object|Array} Systems to add to the cache
// #### @callback {function} Continuation to respond to when complete
//
// Downloads tarballs for all systems to a tmp dir then adds the 
// specified systems to the quill cache for the current machine.
//
exports.add = function (systems, callback) {
  composer.download(systems, function (err, runlist) {
    return err
      ? callback(err)
      : async.forEach(runlist, exports.addOne, callback);
  });
};

//
// ### function add (system, callback)
// #### @system {Object} System to add to the cache. Must specify `system.tarball`.
// #### @callback {function} Continuation to respond to when complete
//
// Adds the specified system which has already been downloaded to a local tarball 
// to the quill cache for the current machine:
//
// 1. Create (or recreate) the necessary directories in the cache
// 2. Untar and move each system into the cache of the form:
//
//    .quill/cache
//      /<name>
//        /<version>
//          system.tgz
//          /system
//
exports.addOne = function (system, callback) {
  var dir = quill.config.get('directories:cache'),
      tmpDir = quill.config.get('directories:tmp'),
      untar = common.tmpFile(tmpDir, system.name, system.version),
      version = { root: path.join(dir, system.name, system.version) },
      target;
      
  version.tarball = path.join(version.root, 'system.tgz');
  version.dir = path.join(version.root, 'system');
  
  async.series([
     //
     // 1. Destroy anything in the cache
     // 2. Rename the temporary tarball to `<cache>/<system>/<version>/system.tgz`.
     // 3. Make a tmp directory to untar files into
     //
     async.apply(common.remkdirp, version.root),
     async.apply(fs.rename, system.tarball, version.tarball),
     async.apply(common.mkdirp, untar),
     //
     // 4. Unpack the tarball into the tmp dir.
     // 5. List the files in the tmp dir, the first will contain the real files
     //
     async.apply(composer.unpack, version.tarball, untar, null),
     function getUntar(next) {
       fs.readdir(untar, function (err, files) {
         //
         // Remark what if there are no files?
         //
         target = path.join(untar, files[0]);
         return next(err);
       })
     },
     //
     // 6. Rename the `target` to `<cache>/<system>/<version>/system`
     // 7. Remove the tmp untar directory.
     //
     function rename(next) {
       fs.rename(target, version.dir, next)
     },
     async.apply(common.rimraf, untar)
   ], function (err) {
     //
     // 8. Invoke the callback
     //
     return err ? callback(err) : callback(null, version);
   });
};

exports.clean = function (callback) {
  
};

exports.list = function (callback) {
  
};