/*
 * keys.js: Commands related to working with SSH keys
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    common = require('flatiron').common,
    quill = require('../../quill'),
    authorizedKeys = quill.common.authorizedKeys;

var keys = exports;

keys.usage = [
  '`quill keys *` commands allow you to download and update',
  'SSH keys on target machines',
  '',
  'quill keys authorize-all',
  'quill keys authorize <username>',
  'quill keys upload <public-key> <name>',
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
// ### function authorize-all (callback)
// #### @callback {function} Continuation to respond to when complete.
// Downloads all known SSH public keys to `~/.ssh/authorized_keys`.
//
keys['authorize-all'] = function (callback) {
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
// Usage for `quill keys authorize-all`.
//
keys['authorize-all'].usage = [
  'Downloads all known SSH public keys to `~/.ssh/authorized_keys`',
  '',
  'quill keys authorize-all'
];

//
// ### function authorize (username, callback)
// #### @username {string} Username to download keys for.
// #### @callback {function} Continuation to respond to when complete.
// Appends the SSH public keys for the specified `username` to `~/.ssh/authorized_keys`.
//
keys.authorize = function (username, callback) {
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
// Usage for `quill keys authorize`.
//
keys.authorize.usage = [
  'Appends the SSH public keys for the specified `username` to `~/.ssh/authorized_keys`',
  '',
  'quill keys authorize <username>'
];

//
// ### function (key, name, callback)
// #### @key {string} File to upload as public key
// #### @name {string} **Optional** Name of the key to upload (e.g. `my-compy`)
// #### @callback {function} Continuation to respond to when complete.
//
// Uploads the local `key` file for the current user to the `name` in conservatory.
// If no `name` is supplied, then `publicKey` will be used.
//
keys.upload = function (key, name, callback) {
  name = name || 'publicKey';
  key = path.resolve(key);
  
  var username = quill.config.get('username');
  
  quill.log.info('Reading local key: ' + key.magenta);
  
  if (path.extname(key) !== '.pub') {
    quill.log.warn('File is not a SSH public key file.');
  }
  
  fs.readFile(key, 'utf8', function (err, data) {
    if (err) {
      return callback(err);
    }
    
    quill.log.info('Uploading ' + name.yellow + ' for ' + username.magenta);
    quill.log.info(key.grey);
    quill.users.addKey(username, name, data, callback);
  });
};

//
// Usage for `quill keys upload`.
//
keys.upload.usage = [
  'Uploads the local `key` file for the current user to the `name` in conservatory.',
  'If no `name` is supplied, then `publicKey` will be used.',
  '',
  'quill keys upload <public-key>',
  'quill keys upload <name>'
];