/*
 * composer.js: Common utility functions for packaging systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var events = require('events'),
    fs = require('fs'),
    path = require('path'),
    zlib = require('zlib'),
    async = require('flatiron').common.async,
    fstream = require('fstream'),
    readDirFiles = require('read-dir-files'),
    tar = require('tar'),
    uidnumber = require('uid-number'),
    ignore = require('./ignore'),
    quill = require('../../quill');
    
var myUid = process.getuid && process.getuid()
    myGid = process.getgid && process.getgid();

var composer = exports;

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
      composer.tar(tarball, dir, files, callback);
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

composer.unpackage = function (tarball, target, options, callback) {
  if (!callback && typeof options === 'function') {
    callback = options;
    options = {};
  }
  
};

//
// ### function tar (tarball, dir, files, callback) 
// #### @tarball {string|Stream} Location of the tarball to create or stream to pipe to.
// #### @dir {string} Base directoty the tarball is being created from.
// #### @files {Array} List of files to include in the tarball
// #### @callback {function} Continuation to respond to when complete.
//
// Creates a tar+gzip stream for the specified `dir` and `files`. If `tarballs` is 
// a string then it is written to disk. If it is a stream then it will be piped to. 
//
// Remark: Adapted from `npm` under MIT. 
//
composer.tar = function (tarball, dir, files, callback) {
  var called = false,
      tgzstream,
      p;

  if (typeof tarball !== 'string' && !tarball.on) {
    return callback(new Error('tarball must be a file or a stream.'));
  }

  files = files.map(function (f) {
    p = f.split(/\/|\\/)[0];
    return path.resolve(dir, f);
  });

  dir = path.resolve(dir, p);

  function done(err) {
    if (called) {
      return;
    }
    
    called = true;
    callback(err);
  }
  
  function logErr(msg) {
    return function (err) {
      quill.log.error(msg);
      quill.log.error(err.message);
      done();
    }
  }

  quill.log.verbose('tarball', { file: tarball });
  quill.log.verbose('source', { dir: dir });
  
  tgzstream = fstream.Reader({ 
    type: 'Directory', 
    path: dir, 
    filter: function () {
      // files should *always* get into tarballs
      // in a user-writable state, even if they're
      // being installed from some wackey vm-mounted
      // read-only filesystem.
      this.props.mode = this.props.mode | 0200
      var inc = -1 !== files.indexOf(this.path)

      // WARNING! Hackety hack!
      // XXX Fix this in a better way.
      // Rename .gitignore to .quillignore if there is not a
      // .quillignore file there already, the better to lock
      // down installed packages with git for deployment.
      if (this.basename === '.gitignore') {
        if (this.parent._entries.indexOf('.quillignore') !== -1) {
          return false;
        }
        
        var d = path.dirname(this.path)
        this.basename = '.quillignore'
        this.path = path.join(d, '.quillignore')
      }
      
      return inc
    }
  })
  .on('error', logErr('error reading ' + dir))
  //
  // By default, quill includes some proprietary attributes in the
  // package tarball.  This is sane, and allowed by the spec.
  // However, quill *itself* excludes these from its own package,
  // so that it can be more easily bootstrapped using old and
  // non-compliant tar implementations.
  //
  .pipe(tar.Pack({ noProprietary: true }))
  .on('error', logErr('tar creation error ' + tarball))
  .pipe(zlib.Gzip())
  .on('error', logErr('gzip error ' + tarball))
  
  if (typeof tarball === 'string') {
    tgzstream.pipe(fstream.Writer({ type: 'File', path: tarball }))
      .on('error', logErr('Could not write ' + tarball))
      .on('close', done)
      .on('error', logErr('error reading ' + dir));
      
    return;    
  }
  
  tgzstream.pipe(tarball)
    .on('error', logErr('Error piping tarball to stream'))
    .on('close', done);    
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
// Remark: Adapted from `npm` under MIT. 
//
composer.untar = function (tarball, target, options, callback) {
  var called = false;

  options            = options            || {};
  options.modes      = options.modes      || {};
  options.modes.exec = options.modes.exec || quill.config.get('modes:exec');
  options.modes.file = options.modes.file || quill.config.get('modes:file');

  //
  // Invokes the `callback` once.
  //
  function done(err) {
    if (called) {
      return;
    }

    called = true;
    callback(err);
  }

  //
  // Logging macro.
  //
  function logErr(msg) {
    return function (err) {
      quill.log && quill.log.error(msg);
      quill.log && quill.log.error(err.message);
      done();
    }
  }

  //
  // Helper function which performs an `lstat` 
  // and `chmod` operation on the `file` (if necessary).
  //
  function modFile(file, next) {
    file = path.resolve(file);

    fs.lstat(file, function (err, stat) {
      if (err || stat.isSymbolicLink()) {
        return next(err);
      }

      function chmod(err) {
        if (err) {
          return next(err);
        }

        var mode = stat.isDirectory() ? options.modes.exec : options.modes.file, 
            oldMode = stat.mode & 0777, 
            newMode = (oldMode | mode) & (~quill.config.get('modes:umask'));

        if (mode && newMode !== oldMode) {
          return fs.chmod(file, newMode, next);
        }

        next();
      }

      return typeof uid === 'number' && typeof gid === 'number'
        ? fs.chown(file, uid, gid, chmod)
        : chmod();
    })
  }

  //
  // Helper function to perform file modifications
  // after the untar operation.
  //
  // XXX Do all this in an Extract filter.
  //
  function afterUntar(err) {
    //
    // if we're not doing ownership management,
    // then we're done now.
    //
    if (err) {
      return logErr('Failed unpacking ' + tarball)(err);
    }

    if (process.platform === 'win32') {
      return fs.readdir(target, function (er, files) {
        files = files.filter(function (f) {
          return f && f.indexOf('\0') === -1
        });

        callback(err, files && path.resolve(target, files[0]));
      });
    }

    readDirFiles.list(target, {
      filter: function (f) {
        return f !== target
      }
    }, function (err, files) {
      if (err) {
        return callback(err);
      }

      async.map(files, modFile, function (err) {
        if (err) {
          return callback(err)
        }

        function chown(err) {
          if (err) {
            return callback(err);
          }

          fs.readdir(target, function (err, folder) {
            //
            // Remark: Not sure what the purpose of this is.
            //
            folder = folder && folder.filter(function (f) {
              return f && !/^\.[_]?/.test(f);
            });

            callback(err, folder && path.resolve(target, folder[0]))
          })
        }

        return typeof myUid === 'number' && typeof myGid === 'number'
          ? fs.chown(target, myUid, myGid, chown)
          : chown();
      });
    });
  }

  quill.log && quill.log.silly('untar modes', {
    exec: options.modes.exec.toString(8), 
    file: options.modes.file.toString(8)
  });

  fs.createReadStream(tarball)
    .on('error', logErr('Error reading: ' + tarball))
    .pipe(zlib.Unzip())
    .on('error', logErr('Unzip error: ' + tarball))
    .pipe(tar.Extract({ type: 'Directory', path: target }))
    .on('error', logErr('Failed unpacking: ' + tarball))
    .on('close', afterUntar);
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