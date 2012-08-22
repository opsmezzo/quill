/*
 * index.js: Tests helpers for `quill`.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var fs = require('fs'),
    path = require('path'),
    common = require('flatiron').common,
    rimraf = common.rimraf,
    quill = require('../../lib/quill');

//
// Setup test directories
//
exports.dirs             = {};
exports.dirs.fixturesDir = path.join(__dirname, '..', 'fixtures');
exports.dirs.systemsDir  = path.join(exports.dirs.fixturesDir, 'systems');
exports.dirs.installDir  = path.join(exports.dirs.fixturesDir, 'installed');
exports.dirs.cacheDir    = path.join(exports.dirs.fixturesDir, 'cache');

exports.init = function (callback) {
  quill.config.stores.file.file = path.join(__dirname, '..', 'fixtures', 'dot-quillconf');
  quill.config.stores.file.loadSync();
  
  quill.init(quill.setup.bind(quill, callback));
};

exports.cleanInstalled = function (systems) {
  try {
    var installDir = exports.dirs.installDir;
    
    fs.readdirSync(installDir)
      .filter(function (file) {
        if (systems && systems.indexOf(file) === -1) {
          return false;
        }
        return file !== '.gitkeep';
      })
      .forEach(function (file) {
        rimraf.sync(path.join(installDir, file));
      });
  }
  catch (ex) {
    console.dir(ex);
  }
}

exports.latestHistory = function (system, count) {
  var historyFile = path.join(exports.dirs.installDir, system.name, 'history.json'),
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  
  return {
    history: history,
    keys: Object.keys(history).slice(-1 * count)
  };
};
