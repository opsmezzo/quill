/*
 * common.js: Common utility functions for quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var fs = require('fs'),
    path = require('path'),
    mkdirp = require('flatiron').common.mkdirp;

var authorizedKeys = exports;

authorizedKeys.__defineGetter__('dir', function () {
  //
  // Remark: How should we configure this for multiple users?
  //
  return quill.config.get('directories:ssh');
});

authorizedKeys.__defineGetter__('filename', function () {
  //
  // Remark: How should we configure this for multiple users?
  //
  return path.join(
    authorizedKeys.dir,
    quill.config.get('authorizedKeys')
  );
});


authorizedKeys.tryRead = function (callback) {
  mkdirp(authorizedKeys.dir, function (err) {
    if (err) {
      return callback(err);
    }
    
    fs.readFile(authorizedKeys.filename, 'utf8', function (err, data) {
      return err && err.code !== 'ENOENT' 
        ? callback(err)
        : callback(null, data);
    });
  });
}

authorizedKeys.overwrite = function (keys, callback) {
  mkdirp(authorizedKeys.dir, function (err) {
    if (err) {
      return callback(err);
    }
    
    fs.writeFile(authorizedKeys.filename, keys.join('\n\n'), callback);
  });
};

authorizedKeys.append = function (keys, callback) {
  authorizedKeys.tryRead(function (err, data) {
    if (err) {
      return callback(err);
    }
    
    if (data) {
      data += '\n\n';
    }
    
    fs.writeFile(authorizedKeys.filename, (data || '') + keys.join('\n\n'), callback);
  });
};