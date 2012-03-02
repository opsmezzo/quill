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
    quill = require('../../quill'),
    authorizedKeys = quill.common.authorizedKeys;

var keys = exports;

keys.usage = [
  '`quill keys *` commands allow you to download and update',
  'SSH keys on target machines',
  '',
  'quill keys downloadall',
  'quill keys download <username>',
  'quill keys hostname'
];

//
// ### function hostname (callback)
// #### @callback {function} Continuation to respond to when complete.
// Displays the hostname for the current machine.
//
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

//
// Usage for `quill keys hostname`.
//
keys.hostname.usage = [
  'Displays the hostname of the current machine',
  '',
  'quill keys hostname',
  'quill hostname'
];

//
// ### function downloadall (callback)
// #### @callback {function} Continuation to respond to when complete.
// Downloads all known SSH public keys to `~/.ssh/authorized_keys`.
//
keys.downloadall = function (callback) {
  quill.log.info('Downloading SSH keys for all users');
  quill.users.getKeys(function (err, keys) {
    if (err) {
      return callback(err, true, true);
    }
    
    quill.log.info('Downloaded ' + keys.length + ' SSH keys.');
    quill.log.warn('About to overwrite ' + authorizedKeys.filename.magenta);
    quill.prompt.get(['yesno'], function (err, result) {
      if (/n[o]?/.test(result.yesno)) {
        quill.log.warn('Operation cancelled');
        return callback();
      }
      
      quill.log.warn('Overwriting ' + authorizedKeys.filename.magenta);
      authorizedKeys.overwrite(keys, callback);
    })
  });
};

//
// Usage for `quill keys downloadall`.
//
keys.downloadall.usage = [
  'Downloads all known SSH public keys to `~/.ssh/authorized_keys`',
  '',
  'quill keys downloadall'
];

//
// ### function download (username, callback)
// #### @username {string} Username to download keys for.
// #### @callback {function} Continuation to respond to when complete.
// Appends the SSH public keys for the specified `username` to `~/.ssh/authorized_keys`.
//
keys.download = function (username, callback) {
  if (!username) {
    return callback(new Error('username is required to download keys'));
  }
  
  quill.users.getKeys(username, function (err, keys) {
    if (err) {
      return callback(err, true, true);
    }
    
    quill.log.info('Downloaded ' + keys.length + ' SSH keys.');
    quill.log.warn('Appending keys to ' + authorizedKeys.filename.magenta);
    authorizedKeys.append(keys, callback);
  });
};

//
// Usage for `quill keys download`.
//
keys.download.usage = [
  'Appends the SSH public keys for the specified `username` to `~/.ssh/authorized_keys`',
  '',
  'quill keys download <username>'
];