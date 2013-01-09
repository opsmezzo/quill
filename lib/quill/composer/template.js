/*
 * template.js: Common utility functions for templating files in system.json packages.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    rget = require('rget'),
    async = require('flatiron').common.async,
    quill = require('../../quill');

//
// ### @private function render (template, data)
// Renders the specified `data` into the `template` string
// using a simple mustache replacement.
//
function render(template, data) {
  var re = /\{\{ ?([\{\}\sa-zA-Z0-9\.\-\_\[\]]+) ?\}\}/g;
  return template.replace(re, function (match, name) {
    name = name.trim();
    name = render(name, data);
    var value = rget(data, name);

    if (value === undefined) {
      throw new Error('Missing configuration value: ' + name);
    }
    else if (typeof value === 'object') {
      value = JSON.stringify(value, null, 2);
    }
    return value;
  });
}

//
// ### function file (file, config, callback)
// #### @file {string} Path of the file to template.
// #### @config {Object} Object to template onto the file.
// #### @callback {function} Continuation to respond to.
// Reads the specified `file`, templates it, and replaces
// it on disk in the same location
//
exports.file = function (file, config, callback) {
  fs.readFile(file, 'utf8', function (err, data) {
    if (err) {
      return callback(err);
    }

    var msg;

    try {
      data = render(data, config)
    }
    catch (ex) {
      if (!quill.argv.force) {
        return callback(new Error(ex.message + ' in ' + file));
      }
    }

    fs.writeFile(file, data, callback);
  });
};

//
// ### function dir (dir, config, callback)
// #### @dir {string} Path of the directory to template.
// #### @config {Object} Object to template onto the file.
// #### @callback {function} Continuation to respond to.
// Reads all files and directories in the specified `dir`,
// templates them, and replaces them on disk in the same location.
//
exports.directory = function (dir, config, callback) {
  fs.readdir(dir, function (err, files) {
    if (err) {
      //
      // Directory doesn't exist, there's nothing to template. Not a big deal.
      //
      return err.code !== 'ENOENT'
        ? callback(err)
        : callback();
    }

    async.forEach(
      files,
      function (file, next) {
        file = path.join(dir, file);
        fs.stat(file, function (err, stat) {
          if (err) {
            return next(err);
          }

          return stat.isDirectory()
            ? exports.directory(file, config, next)
            : exports.file(file, config, next);
        });
      },
      callback
    );
  });
};
