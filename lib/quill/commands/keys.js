/*
 * keys.js: Commands related to working with SSH keys
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    os = require('os'),
    path = require('path'),
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
  'quill keys hostname'
];

//
// ### function hostname (callback)
// #### @callback {function} Continuation to respond to when complete.
// Displays the hostname for the current machine.
//
keys.hostname = function (callback) {
  var hostname = os.hostname();
  quill.log.info(hostname);
  callback(null, hostname);
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
      return callback(err, true);
    }

    quill.log.info('Downloaded ' + keys.length + ' SSH keys.');
    quill.log.warn('About to overwrite ' + authorizedKeys.filename.magenta);

    //
    // Helper function which actually overwrites keys
    //
    function overwriteKeys() {
      quill.log.warn('Overwriting ' + authorizedKeys.filename.magenta);
      authorizedKeys.overwrite(
        keys.map(function (key) {
          return key.key || key;
        }),
        callback
      );
    }

    if (quill.argv.yes) {
      return overwriteKeys();
    }

    quill.prompt.get(['yesno'], function (err, result) {
      if (err) {
        return callback(err);
      }

      if (/n[o]?/.test(result.yesno)) {
        quill.log.warn('Operation cancelled');
        return callback();
      }

      overwriteKeys();
    });
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
      return callback(err, true);
    }

    quill.log.info('Downloaded ' + keys.length + ' SSH keys.');
    quill.log.warn('Appending keys to ' + authorizedKeys.filename.magenta);
    authorizedKeys.append(
      keys.map(function (key) {
        return key.key || key
      }),
      callback
    );
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
