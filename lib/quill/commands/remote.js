/*
 * remote.js: Commands related to working with remote configs
 *
 * (C) 2012, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
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
// ### function delete (name, callback)
// Delete `name` remote config.
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
// ### function view (name, callback)
// View `name` remote config.
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

      quill.inspect.putObject(remote);
      callback();
    });
  });
};

//
// ### function get (name, key, callback)
// Get key `key` from remote config `name`.
//
remote.get = function (name, key, callback) {
  if (!name || !key) {
    return callback(new Error('Config name and key required.'));
  }

  quill.remote.get(name, function (err, remote) {
    if (err) {
      return callback(err);
    }
  
    quill.log.data(key.yellow + ' ' + remote.settings[key].magenta);
    callback();
  });
};

//
// ### function set (name, key, value, callback)
// Set key `key` in remote config `name` to `value`.
//
remote.set = function (name, key, value, callback) {
  if (!name || !key || !value) {
    return callback(new Error('Config name, key and value required.'));
  }

  quill.remote.set(name, key, value, callback);
};

//
// ### function clear (name, key, callback)
// Clear key `key` from remote config `name`.
//
remote.clear = function (name, key, callback) {
  if (!name || !key) {
    return callback(new Error('Config name and key required.'));
  }

  quill.remote.clear(name, key, callback);
};

remote.load = function (name, file, callback) {
  if (!name || !file) {
    return callback(new Error('Config name and file required.'));
  }

  quill.log.info('Loading file ' + file.magenta + ' into ' + name.magenta + ' config');

  fs.readFile(file, function (err, data) {
    if (err) {
      return callback(err);
    }

    data = JSON.parse(data);
    quill.remote.destroy(name, function () {
      //
      // Ignore errors here.
      //
      quill.remote.create(name, data, callback);
    });
  });
};

//
// ### function merge (name, file, callback)
// Merge `file` into remote config `name`.
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

    data = JSON.parse(data);

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

        Object.keys(data).forEach(function (key) {
          remote[key] = data[key];
        });

        quill.remote.create(name, remote, callback);
      });
    });
  });
};
