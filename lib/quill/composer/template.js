var fs = require('fs'),
    path = require('path'),
    rget = require('rget'),
    async = require('flatiron').common.async;

function render(template, data) {
  var re = /\{\{ ?([a-zA-Z0-9\.\-]+) ?\}\}/g;
  return template.replace(re, function (match, name) {
    return rget(data, name);
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
        return exports.file(path.join(dir, file), config, next);
      },
      callback
    );
  });
};
