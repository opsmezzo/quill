/*
 * template.js: Common utility functions for templating files in system.json packages.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    rget = require('rget'),
    async = require('flatiron').common.async;

//
// ### @private function render (template, data)
// Renders the specified `data` into the `template` string
// using a simple mustache replacement.
//
function render(template, data) {
  var re = /\{\{ ?([a-zA-Z0-9\.\-]+) ?\}\}/g;
  return template.replace(re, function (match, name) {
    var value = rget(data, name);
    if (typeof value === 'object') {
      value = JSON.stringify(value);
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
  fs.readFile(file, function (err, data) {
    if (err) {
      return callback(err);
    }

    fs.writeFile(file, render(data.toString('utf8'), config), callback);
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
      if (err.code === 'ENOENT') {
        //
        // Directory doesn't exist, there's nothing to template. Not a big deal.
        //
        return callback();
      }
      return callback(err);
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
