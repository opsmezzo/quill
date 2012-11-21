var fs = require('fs'),
    path = require('path'),
    rget = require('rget'),
    async = require('flatiron').common.async;

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

exports.file = function (file, config, callback) {
  fs.readFile(file, function (err, data) {
    if (err) {
      return callback(err);
    }

    fs.writeFile(file, render(data.toString('utf8'), config), callback);
  });
};

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
