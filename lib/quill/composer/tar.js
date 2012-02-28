/*
 * tar.js: Common utility functions for handling tarballs.
 *
 * (C) 2011, Isaac Schlueter
 * (C) 2012, Nodejitsu Inc. 
 * Adapted from `npm` under MIT. 
 *
 */

var fs = require('fs'),
    path = require('path'),
    zlib = require('zlib'),
    async = require('flatiron').common.async,
    fstream = require('fstream'),
    readDirFiles = require('read-dir-files'),
    tar = require('tar'),
    uidnumber = require('uid-number'),
    quill = require('../../quill');
    
var myUid = process.getuid && process.getuid()
    myGid = process.getgid && process.getgid();


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
// Remark: Adapted from `npm` under MIT. 
//
exports.pack = function (tarball, dir, files, callback) {
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
exports.unpack = function (tarball, target, options, callback) {
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