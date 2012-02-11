/*
 * keys.js: Commands related to working with SSH keys
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    common = require('flatiron').common,
    async = common.async,
    rimraf = common.rimraf,
    quill = require('../../quill');
    
var keys = exports;

keys.usage = [
  '`quill keys *` commands allow you to install and update',
  'SSH keys on target machines',
  '',
  'quill keys downloadall',
  'quill keys download',
  'quill keys hostname'
];

keys.hostname = function (callback) {
  exec('hostname', function (err, stdout, stderr) {
    if (err) {
      return callback(err);
    }
    
    var hostname = stdout.split('\n').filter(Boolean)[0];
    quill.log.info(hostname);
    callback(null, hostname);
  });
};