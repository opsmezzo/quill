/*
 * installed.js: Manages currently installed systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    fstream = require('fstream'),
    composer = require('./index'),
    quill = require('../../quill'),
    common = quill.common,
    async = common.async;

//
// ### function add (systems, callback)
// #### @systems {Array} Systems to add to the install directory
// #### @callback {function} Continuation to respond to when complete
//
// Copies the specified systems from the cache to the install dir
// if the system is installed with a different version an error will be thrown.
//
exports.add = function (systems, callback) {
  async.map(systems, exports.addOne, callback);
};

//
// ### function add (system, callback)
// #### @system {Object} System to add to the install directory. Must specify `system.path`.
// #### @callback {function} Continuation to respond to when complete
//
// Adds the specified system which has already been added to the local cache
// to the quill install directory for the current machine:
//
// 1. Check to see if the system is already installed.
//   * If it is and the versions do not match, respond with an error
// 2. Move the system into place
//
//    .quill/install
//      /<system>
//        /<version>
//        /history.json
//
// 3. Update the history for the system
//
exports.addOne = function (system, callback) {
  var dir = quill.config.get('directories:install'),
      systemDir = path.join(dir, system.name),
      versionDir = path.join(systemDir, system.version);
  
  //
  // Helper function which checks for any existing
  // version of the system to install.
  //
  function checkInstalled(next) {
    exports.read(system, function (err, install) {
      if (err) {
        return err.code === 'ENOENT' 
          ? next()
          : callback(err);
      }
      else if (!install.system) {
        return next();
      }
      
      //
      // If a different version is installed respond
      // with an error.
      //
      if (system.version !== install.system.version) {
        return callback(new Error([
          'Cannot install',
          system.version, 
          'over existing version:',
          install.system.version
        ].join(' ')));
      }
      
      //
      // Otherwise this version is already installed so 
      // short-circuit and respond to the callback.
      //
      system.path = versionDir;
      return callback(null, system);
    });
  }
  
  async.series([
    //
    // 1. Attempt to read the system history.
    //   * If it does exist check the version and history
    //     before continuing
    //
    checkInstalled,
    //
    // 2. If it does not already exist, copy the system into place.
    //
    async.apply(common.mkdirp, versionDir),
    function copyVersion(next) {
      var responded;
      
      function done(err) {
        if (!responded) {
          responded = true;
          next(err);
        }
      }

      fstream.Reader({ type: 'Directory', path: system.path })
        .on('error', done)
        .pipe(fstream.Writer({ type: 'Directory', path: versionDir }))
        .on('error', done)
        .on('end', done);
    }
    //
    // 3. Update the history for the system. 
    //
    //
    // TODO: DO THIS!
    //
  ], function (err) {
    //
    // 4. Invoke the callback
    //
    system.path = versionDir;
    return err ? callback(err) : callback(null, system);
  });
};

//
// ### function remove (systems, callback)
// #### @systems {string|Object|Array} Systems to remove from the cache
// #### @callback {function} Continuation to respond to when complete
// 
// Removes the specified `systems` from the install directory. 
//
exports.remove = function (systems, callback) {
  var installDir = quill.config.get('directories:install'),
      names = composer.systemNames(systems);
  
  //
  // Helper function which removes a single version
  //
  function removeOne(name, next) {
    var systemDir = path.join(installDir, name);
    
    fs.readdir(systemDir, function (err, files) {
      if (err) {
        return err.code !== 'ENOENT'
          ? next(err)
          : next();
      }
      
      files = files.map(function (file) {
        return path.join(systemDir, file);
      });
      
      async.filter(files, common.isDirectory, function (dirs) {
        //
        // TODO: Check to see if there is more than one version installed.
        // TODO: Update versions
        //
        async.forEach(dirs, common.rimraf, next);
      });
    });
  }
  
  async.forEach(names.map(function (parts) {
    return parts[0];
  }), removeOne, callback);
};

//
// ### function list (callback)
// #### @callback {function} Continuation to respond to when complete
//
// Lists all systems and versions in the cache.
//
exports.list = function (callback) {
  var installDir = quill.config.get('directories:install');
  
  //
  // Helper function which reads all `system.json` and
  // `history.json` files in parallel.
  //
  function readSystems(dirs) {
    if (!dirs || !dirs.length) {
      return callback(null, null);
    }
    
    var systems = {};
    
    dirs.forEach(function (dir) {
      var system = path.basename(dir);
      systems[system] = exports.read.bind(null, system);
    });
    
    async.parallel(systems, callback);
  }
  
  fs.readdir(installDir, function (err, dirs) {
    if (err) {
      return callback(err);
    }

    async.filter(dirs.map(function (dir) {
      return path.join(installDir, dir);
    }), common.isDirectory, readSystems);
  });
};

//
// ### function read (system, callback)
// #### @system {string|Object} System to read from the install directory.
// #### @callback {function} Continuation to respond to when complete.
//
// Attempts to read the `system` from the quill install directory.
//
exports.read = function (system, callback) {
  if (typeof system === 'string') {
    system = { name: system };
  }
  
  var dir = quill.config.get('directories:install'),
      systemDir = path.join(dir, system.name);
  
  //
  // Helper function which reads the install history for
  // the `system`.
  //
  function readHistory(next) {
    fs.readFile(path.join(systemDir, 'history.json'), 'utf8', function (err, data) {
      if (err) {
        return err.code === 'ENOENT'
          ? next(null, null)
          : next(err)
      }
      
      next(null, JSON.parse(data));
    });
  }
  
  //
  // Helper function which reads the `system.json` and 
  // `history.json` for the `system`.
  //
  function readVersion(dirs, next) {
    if (dirs.length > 1) {
      //
      // Remark: We should resolve against history here.
      //
      return callback(new Error('Too many versions installed: ' + dirs.length));
    }
    
    var versionDir = dirs[0];
    
    async.parallel({
      system: function tryRead(next) {
        composer.readJson(versionDir, function (err, pkg) {
          if (err) {
            return err.code === 'ENOENT'
              ? next(null, null)
              : next(err);
          }
          
          next(null, pkg);
        });
      },
      history: readHistory
    }, next);
  }
  
  async.waterfall([
    //
    // 1. List files in the `systemDir`
    //
    async.apply(fs.readdir, systemDir),
    //
    // 2. Filter for directories
    //
    function filterDirectories(files, next) {
      async.filter(files.map(function (file) {
        return path.join(systemDir, file);
      }), common.isDirectory, next.bind(null, null));
    },
    //
    // 3. Read `<system>/<version>/system.json` and
    //    `<system>/history.json`.
    //
    readVersion
  ], function (err, record) {
    //
    // 4. Invoke the callback with the error or install record.
    //
    return err ? callback(err) : callback(null, record);
  });
};