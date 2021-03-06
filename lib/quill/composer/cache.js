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
    rimraf = require('rimraf'),
    async = common.async;

//
// ### function add (systems, callback)
// #### @options {Object} Options for the download
// ####   @options.systems {Array|Object} List of systems to add to the cache.
// ####   @options.dir     {string} **Optional** Directory to download files in.
// ####   @options.meter   {multimeter} CLI multimeter to display when downloading.
// #### @callback {function} Continuation to respond to when complete
//
// Downloads tarballs for all systems to a tmp dir then adds the
// specified systems to the quill cache for the current machine.
//
exports.add = function (options, callback) {
  async.waterfall([
    //
    // 1. List all cached systems
    //
    async.apply(exports.list),
    //
    // 2. Filter the `systems` by those that are already cached.
    //
    function filterCached(cached, next) {
      next(null, options.systems.reduce(function (all, system) {
        if (!cached[system.name] || !~cached[system.name].indexOf(system.version)) {
          all.uncached.push(system);
          return all;
        }

        all.cached.push(system.name);
        return all;
      }, { cached: [], uncached: [] }));
    },
    //
    // 3. Download and install all uncached systems
    //
    function downloadAndInstall(result, done) {
      var cacheDir = quill.config.get('directories:cache');

      composer.download({
        systems: result.uncached,
        meter: options.meter,
        dir: options.dir
      }, function (err, runlist) {
        if (options.meter) {
          options.meter.stack.clear();
          options.meter.charm.cursor(true);
          options.meter.destroy();
        }

        if (err) {
          return callback(err);
        }

        async.map(
          options.systems,
          function cacheOne(system, next) {
            if (~result.cached.indexOf(system.name)) {
              system.root    = path.join(cacheDir, system.name, system.version);
              system.tarball = path.join(system.root, 'system.tgz');
              system.cached  = path.join(system.root, 'system');
              return next(null, system);
            }

            exports.addOne(system, next);
          },
          done
        );
      });
    }
  ], callback);
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
  var dir     = quill.config.get('directories:cache'),
      tmpDir  = quill.config.get('directories:tmp'),
      untar   = common.tmpFile(tmpDir, system.name, system.version),
      tarball = system.tarball,
      target;
  
  system.root    = path.join(dir, system.name, system.version);
  system.tarball = path.join(system.root, 'system.tgz');
  system.cached  = path.join(system.root, 'system');
  
  quill.log.info([
    'Adding',
    [system.name, system.version].join('@').magenta,
    'to local cache.'
  ].join(' '));

  async.series([
     //
     // 1. Destroy anything in the cache
     // 2. Rename the temporary tarball to `<cache>/<system>/<version>/system.tgz`.
     // 3. Make a tmp directory to untar files into
     //
     async.apply(common.remkdirp, system.root),
     async.apply(fs.rename, tarball, system.tarball),
     async.apply(common.mkdirp, untar),
     //
     // 4. Unpack the tarball into the tmp dir.
     // 5. List the files in the tmp dir, the first will contain the real files
     //
     async.apply(composer.unpack, system.tarball, untar, null),
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
       fs.rename(target, system.cached, next)
     },
     async.apply(rimraf, untar)
   ], function (err) {
     //
     // 8. Invoke the callback
     //
     return err ? callback(err) : callback(null, system);
   });
};

//
// ### function clean (systems, callback)
// #### @systems {string|Object|Array} **Optional** Systems to remove from the cache
// #### @callback {function} Continuation to respond to when complete
// 
// Removes the specified `systems` from the cache. If no `systems` are supplied
// all systems are removed.
//
exports.clean = function (systems, callback) {
  if (!callback && typeof systems === 'function') {
    callback = systems;
    systems = [];
  }
  
  var cacheDir = quill.config.get('directories:cache'),
      names = composer.dependencies.systemNames(systems);

  //
  // Helper function to determine if a dir should
  // be removed.
  //
  function shouldRemove(dir) {
    return !names.length || names.filter(function (parts) {
      return parts[0] === dir;
    }).length;
  }
  
  //
  // Helper function which removes a single
  // system with optional version
  //
  function cleanOne(dir, next) {
    //
    // TODO: Check the version of the `dir`.
    //
    if (!shouldRemove(dir)) {
      return next();
    }

    var fullpath = path.join(cacheDir, dir);
        
    fs.stat(fullpath, function (err, stat) {
      if (err) {
        return next(err);
      }
      else if (!stat.isDirectory()) {
        return next();
      }
      
      common.rimraf(fullpath, next);
    });
  }
  
  
  fs.readdir(cacheDir, function (err, dirs) {
    if (err) {
      return callback(err);
    }
        
    async.forEach(dirs, cleanOne, callback);
  });
};

//
// ### function list (callback)
// #### @callback {function} Continuation to respond to when complete
//
// Lists all systems and versions in the cache.
//
exports.list = function (callback) {
  var cacheDir = quill.config.get('directories:cache'),
      systems  = {};
  
  //
  // Helper function which lists the versions for the specified `dir`.
  //
  function listVersions(dir, next) {
    var fullpath = path.join(cacheDir, dir);
    
    fs.stat(fullpath, function (err, stat) {
      if (err) {
        return next(err);
      }
      else if (!stat.isDirectory()) {
        return next();
      }

      fs.readdir(fullpath, function (err, versions) {
        if (err) {
          return next(err);
        }

        systems[dir] = versions;
        next();
      });
    });
  }
  
  fs.readdir(cacheDir, function (err, dirs) {
    if (err) {
      return callback(err);
    }

    async.forEach(dirs, listVersions, function (err) {
      return err ? callback(err) : callback(null, systems);
    });
  });
};
