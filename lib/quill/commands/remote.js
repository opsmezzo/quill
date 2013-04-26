/*
 * remote.js: Commands related to working with remote configs
 *
 * (C) 2012, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    objs = require('objs'),
    quill = require('../../quill');

var remote = exports;

remote.usage = [
  '`quill remote` commands allow you to work with remote configs',
  '',
  'quill remote create <name>',
  'quill remote list',
  'quill remote delete <name>',
  'quill remote view <name>',
  'quill remote get <name> <key>',
  'quill remote set <name> <key> <value>',
  'quill remote clear <name> <key>',
  'quill remote load <name> <file>'
];

//
// ### function create (name, callback)
// Creates a remote config called `name`.
//
remote.create = function (name, callback) {
  if (name) {
    quill.prompt.override.name = name;
  }

  quill.prompt.get(['name'], function (err, result) {
    if (err) {
      return callback(err);
    }

    quill.log.info('Creating remote config: ' + result.name.magenta);
    quill.remote.create(result.name, {}, callback);
  });
};

//
// Usage for `quill remote create`
//
remote.create.usage = [
  'Creates a remote config called <name>',
  '',
  'quill remote create <name>'
];

//
// ### function list (callback)
// Lists remote configs.
//
remote.list = function (callback) {
  quill.remote.list(function (err, remotes) {
    if (err) {
      return callback(err);
    }
    else if (!remotes || !remotes.length) {
      quill.log.warn('No remotes found');
      return callback();
    }

    var rows = [['name']],
        colors = ['underline'];

    remotes.forEach(function (remote) {
      rows.push([remote.name]);
    });

    quill.inspect.putRows('data', rows, colors);
    callback();
  });
};

//
// Usage for `quill remote list`
//
remote.create.usage = [
  'Lists named remote configurations.',
  '',
  'quill remote list'
];

//
// ### function delete (name, callback)
// Attempts to delete the remote configuration with `name`.
//
remote.delete = function (name, callback) {
  if (name) {
    quill.prompt.override.name = name;
  }

  quill.prompt.get(['name'], function (err, result) {
    if (err) {
      return callback(err);
    }

    quill.log.info('Deleting remote config: ' + result.name.magenta);
    quill.remote.destroy(result.name, callback);
  });
};

//
// Usage for `quill remote delete`
//
remote.delete.usage = [
  'Attempts to delete the remote configuration with <name>.',
  '',
  'quill remote delete <name>'
];

//
// ### function view (name, callback)
// Views the remote configuration with `name`.
//
remote.view = function (name, callback) {
  if (name) {
    quill.prompt.override.name = name;
  }

  quill.prompt.get(['name'], function (err, result) {
    if (err) {
      return callback(err);
    }

    quill.log.info('Viewing remote config: ' + result.name.magenta);
    quill.remote.get(result.name, function (err, remote) {
      if (err) {
        return callback(err);
      }

      quill.inspect.putObject(remote.settings);
      callback();
    });
  });
};

//
// Usage for `quill remote view <name>`
//
remote.view.usage = [
  'Views the remote configuration with <name>.',
  '',
  'quill remote view <name>'
];

//
// ### function get (name, key, callback)
// Displays the value of the `key` in the remote configuration with `name`.
//
remote.get = function (name, key, callback) {
  if (!name || !key) {
    return callback(new Error('Config name and key required.'));
  }

  quill.remote.get(name, function (err, remote) {
    if (err) {
      return callback(err);
    }
  
    var value = remote.settings[key];
    if (typeof value !== 'object') {
      quill.log.data(key.yellow + ' ' + (value + '').magenta);
    }
    else {
      quill.log.data(key.yellow);
      quill.inspect.putObject(value);
    }

    callback();
  });
};

//
// Usage for `quill remote get <name> <key>`
//
remote.get.usage = [
  'Displays the value of the <key> in the remote configuration with <name>.',
  '',
  'quill remote get <name> <key>'
];

//
// ### function set (name, key, value, callback)
// Sets the `key` to `value` in the remote configuration with `name`.
//
remote.set = function (name, key, value, callback) {
  if (!name || !key || !value) {
    return callback(new Error('Config name, key and value required.'));
  }

  quill.remote.set(name, key.replace(/\:/g, '/'), value, callback);
};

//
// Usage for `quill remote set <name> <key> <value>`
//
remote.set.usage = [
  'Sets the <key> to <value> in the remote configuration with <name>.',
  '',
  'quill remote set <name> <key> <value>'
];

//
// ### function clear (name, key, callback)
// Clears the `key` in the remote configuration with `name`.
//
remote.clear = function (name, key, callback) {
  if (!name || !key) {
    return callback(new Error('Config name and key required.'));
  }

  quill.remote.clear(name, key.replace(/\:/g, '/'), callback);
};

//
// Usage for `quill remote clear <name> <key>`
//
remote.clear.usage = [
  'Clears the <key> in the remote configuration with <name>.',
  '',
  'quill remote clear <name> <key>'
];

//
// ### function load (name, file, callback)
// Loads all keys and values in `file` into the remote configuration with `name`.
// Warning: will overwrite any existing values
//
remote.load = function (name, file, callback) {
  if (!name || !file) {
    return callback(new Error('Config name and file required.'));
  }

  quill.log.info('Loading file ' + file.magenta + ' into ' + name.magenta + ' config');

  fs.readFile(file, function (err, data) {
    if (err) {
      return callback(err);
    }

    try { data = JSON.parse(data) }
    catch (ex) { return callback(ex) }

    quill.remote.destroy(name, function () {
      //
      // Ignore errors here.
      //
      quill.remote.create(name, data, callback);
    });
  });
};

//
// Usage for `quill remote load <name> <file>`
//
remote.load.usage = [
  'Loads all keys and values in <file> into the remote configuration with <name>.',
  'Warning: will overwrite any existing values',
  '',
  'quill remote load <name> <file>'
];

//
// ### function merge (name, file, callback)
// Merges all keys and values in `file` into remote configuration with `name`.
//
remote.merge = function (name, file, callback) {
  if (!name || !file) {
    return callback(new Error('Config name and file required.'));
  }

  quill.log.info('Merging file ' + file.magenta + ' into ' + name.magenta + ' config');

  fs.readFile(file, function (err, data) {
    if (err) {
      return callback(err);
    }

    try { data = JSON.parse(data) }
    catch (ex) { return callback(ex) }

    //
    // Instead of merging config on the server side, merge it locally:
    // fetch it, merge and recreate.
    //
    quill.remote.get(name, function (err, remote) {
      if (err) {
        return callback(err);
      }

      quill.remote.destroy(name, function () {
        if (err) {
          return callback(err);
        }

        remote.settings = objs.merge.deep(remote.settings, data);
        quill.remote.create(name, remote.settings, callback);
      });
    });
  });
};

//
// Usage for `quill remote merge <name> <file>`
//
remote.merge.usage = [
  'Merges all keys and values in <file> into remote configuration with <name>.',
  '',
  'quill remote merge <name> <file>'
];