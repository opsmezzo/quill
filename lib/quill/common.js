/*
 * common.js: Common utility functions for quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var fs = require('fs'),
    path = require('path'),
    flatiron = require('flatiron'),
    quill = require('../quill');

var common = module.exports = flatiron.common.clone(flatiron.common);

common.authorizedKeys = function () {
  //
  // TODO: How should we configure this for multiple users?
  //
  return path.join(
    process.env.HOME,
    '.ssh',
    'authorized_keys'
  );
};

common.appendKeys = function (keys, callback) {
  var authorizedKeys = common.authorizedKeys();
  
  fs.readFile(authorizedKeys, 'utf8', function (err, data) {
    if (err && err.code !== 'ENOENT') {
      return callback(err);
    }
    
    if (data) {
      data += '\n\n';
    }
    
    fs.writeFile(authorizedKeys, data || '' + keys.join('\n\n'), callback);
  });
};