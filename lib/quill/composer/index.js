/*
 * composer.js: Common utility functions for packaging systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var events = require('events'),
    fs = require('fs'),
    path = require('path'),
    async = require('flatiron').common.async,
    ignore = require('./ignore'),
    tar = require('./tar');
    
var composer = exports;

//
// Hoist `tar` helpers onto `composer`.
//
composer.tar = tar;

//
// ### function readJson (dir, callback)
// #### @dir {string} Directory to read the system from.
// #### @callback {function} Continuation to respond to when complete.
//
// Reads the system located at the specified `dir` asynchronously.
//
composer.readJson = function (dir, callback) {
  if (!callback && typeof dir === 'function') {
    callback = dir;
    dir = process.cwd();
  }
  
  var pkg = {
    path: path.resolve(dir)
  };
  
  //
  // Remark: This is actually much harder than you would think.
  // See `/npm/lib/utils/read-json.js` and `/npm/lib/utils/load-package-defaults`.
  // We should eventually use that code. 
  //
  function readJson(next) {
    fs.readFile(path.join(dir, 'system.json'), 'utf8', function (err, system) {
      if (err) {
        return next(err);
      }
      
      try { system = JSON.parse(system); }
      catch (ex) { return next(err); }
      
      Object.keys(system).forEach(function (key) {
        pkg[key] = system[key];
      });
            
      next();
    });
  }
  
  //
  // Helper function to load files from disk asychronously.
  //
  function loadResources(key, next) {
    var resourceDir = path.join(dir, key);
    
    fs.readdir(resourceDir, function (err, files) {
      if (err) {
        return err.code === 'ENOENT' ? next() : next(err);
      }
      
      pkg[key] = files.slice(0);
      next();
    });
  }
    
  async.parallel([
    readJson,
    loadResources.bind(null, 'files'),
    loadResources.bind(null, 'scripts')
  ], function (err) {
    return err ? callback(err) : callback(null, pkg);
  });
};

//
// ### function package (dir, tarball, callback) 
// #### @dir {string} Directory to read the system from.
// #### @tarball {string|Stream} Location of the tarball to create or stream to pipe to.
// #### @callback {function} Continuation to respond to when complete.
//
// Creates a tarball package for the system at the specified `dir`.
//
composer.package = function (dir, tarball, callback) {
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
      tar.pack(tarball, dir, files, callback);
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
composer.publish = function (system, tarball, callback) {
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
// ### function install (systems, callback)
// #### @systems {Array} List of systems to install on the target machine.
// #### @callback {function} Continuation to respond to when complete.
//
// Installs the target `systems` on the current machine.
//
composer.install = function (systems, callback) {
  
};

//
// ### function download (systems, callback)
// #### @systems {Array} List of systems to download to the target machine.
// #### @callback {function} Continuation to respond to when complete.
//
composer.download = function (systems, callback) {
  
};

//
// ### function dependencies (systems, callback)
// #### @systems {Array} List of systems to create dependency list for.
// #### @callback {function} Continuation to respond to when complete.
//
// Creates a dependency list for the specified `systems`.
//
composer.dependencies = function (systems, callback) {
  
};

//
// ### function runlist (systems, callback)
// #### @systems {Array} List of systems to create runlist for.
// #### @callback {function} Continuation to respond to when complete.
//
// Creates a runlist for the specified `systems`.
//
composer.runlist = function (systems, callback) {
  
};

//
// ### function listFiles (dir, callback) 
// #### @dir {string} Directory to list system files from.
// #### @callback {function} Continuation to respond to when complete.
//
// Responds with a list of all files for the system in the target `dir`.
//
// Remark: Adapted from `npm` under MIT. 
//
composer.listFiles = function (dir, pkg, exList, callback) {
  if (!callback && typeof exList === 'function') {
    callback = exList;
    exList = [];
  }
  
  var errState = null;
  
  function filterFiles(err, files) {
    if (errState) {
      return;
    }
    else if (err) {
      return callback(errState = err, []);
    }

    if (path.basename(dir) === 'systems'
      && pkg.path === path.dirname(dir)) {
      files = composer.filterSystems(files, pkg);
    } 
    else {
      //
      // If a directory is excluded, we still need to be
      // able to *include* a file within it, and have that override
      // the prior exclusion.
      //
      // This whole makeList thing probably needs to be rewritten
      //
      files = files.filter(function (f) {
        return ignore.filter(dir, exList)(f) || f.slice(-1) === '/';
      });
    }

    async.map(files, function (file, next) {
      //
      // if this is a dir, then dive into it.
      // otherwise, don't.
      //
      file = path.resolve(dir, file);

      //
      // in 0.6.0, fs.readdir can produce some really odd results.
      // XXX: remove this and make the engines hash exclude 0.6.0
      //
      if (file.indexOf(dir) !== 0) {
        return next(null, []);
      }

      fs.lstat(file, function (er, st) {
        if (err) {
          return next(err);
        }
        
        return st.isDirectory()
          ? composer.listFiles(file, pkg, exList, next)
          : next(null, file);
      });
    }, function (err, files) {
      if (files.length > 0) {
        files.push(dir);
      }
      
      var result = [];
      
      //
      // Remark: This could be more memory efficient.
      //
      for (var i = 0; i < files.length; i++) {
        if (Array.isArray(files[i])) {
          result = result.concat(files[i]);
        }
        else if (files[i]) {
          result.push(files[i])
        }
        
        delete files[i];
      }
      
      return callback(err, result);
    });
  }
  
  //
  // Read the specified directory and ignore any obvious files,
  // and parse any ignore files.
  //
  composer.readDir(dir, function (err, files) {
    if (err) {
      return callback(err)
    }
    
    files = files.map(function (f) {
      //
      // no nulls in paths!
      //
      return f.split(/\0/)[0]
    }).filter(function (f) {
      //
      // always remove all source control folders and
      // waf/vim/OSX garbage. this is a firm requirement.
      //
      return !( f === '.git/'
        || f === '.lock-wscript'
        || f === 'CVS/'
        || f === '.svn/'
        || f === '.hg/'
        || f.match(/^\..*\.swp/)
        || f === '.DS_Store'
        || f.match(/^\._/)
        || f === 'npm-debug.log'
        || f === ''
        || f.charAt(0) === '/'
      );
    });

    if (files.indexOf('.quillignore') === -1
      && files.indexOf('.gitignore') === -1) {
      filterFiles(null, files);
    }
    else {
      ignore.addIgnoreFile(
        path.resolve(dir, '.quillignore'), 
        '.gitignore', 
        exList, 
        dir, 
        function (err, list) {
          if (!err) {
            exList = list
          }

          filterFiles(err, files);
        }
      );
    }
  });
}

//
// ### function (dir, callback)
// #### @dir {string} Directory to read files.
// #### @callback {function} Continuation to respond to when complete
// 
// Patterns ending in slashes will only match targets
// ending in slashes.  To implement this, add a / to
// the filename iff it lstats isDirectory()
//
// Remark: Adapted from `npm` under MIT. 
//
composer.readDir = function (dir, callback) {
  fs.readdir(dir, function (err, files) {
    if (err) {
      return callback(er);
    }
    
    files = files.filter(function (f) {
      return f && f.charAt(0) !== '/' && f.indexOf('\0') === -1
    });
    
    async.map(files, function (file, next) {
      fs.lstat(path.resolve(dir, file), function (err, st) {
        if (err) {
          return next(null, []);
        }
        
        // if it's a directory, then tack '/' onto the name
        // so that it can match dir-only patterns in the
        // include/exclude logic later.
        if (st.isDirectory()) {
          return next(null, file + '/');
        }

        // if it's a symlink, then we need to do some more
        // complex stuff for GH-691
        //
        // TODO: Follow symlinks
        //
        //if (st.isSymbolicLink()) return readSymlink(dir, file, pkg, dfc, cb)

        // otherwise, just let it on through.
        return next(null, file)
      })
    }, callback);
  });
};