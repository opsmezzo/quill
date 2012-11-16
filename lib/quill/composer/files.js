/*
 * files.js: Composer functions for working with local system files (system.json, ignore files, etc).
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var events = require('events'),
    fs = require('fs'),
    path = require('path'),
    common = require('flatiron').common,
    async = common.async,
    composer = require('./index'),
    ignore = require('./ignore'),
    quill = require('../../quill');

//
// ### function readJson (dir, callback)
// #### @dir {string} Directory to read the system from.
// #### @callback {function} Continuation to respond to when complete.
//
// Reads the system located at the specified `dir` asynchronously.
//
exports.readJson = function (dir, callback) {
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
      catch (ex) { return next(ex); }
      
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
// ### function listFiles (dir, callback) 
// #### @dir {string} Directory to list system files from.
// #### @callback {function} Continuation to respond to when complete.
//
// Responds with a list of all files for the system in the target `dir`.
//
// Remark: Adapted from `npm` under MIT. 
//
exports.listFiles = function (dir, pkg, exList, callback) {
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
exports.readDir = function (dir, callback) {
  fs.readdir(dir, function (err, files) {
    if (err) {
      return callback(err);
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
