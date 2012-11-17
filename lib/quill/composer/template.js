var fs = require('fs'),
    path = require('path'),
    async = require('flatiron').common.async,
    mustache = require('mustache');

exports.file = function (file, config, callback) {
  fs.readFile(file, function (err, data) {
    if (err) {
      return callback(err);
    }

    fs.writeFile(file + '.bak', data);
    fs.writeFile(file, mustache.render(data.toString('utf8'), config), callback);
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
