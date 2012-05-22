/*
 * index.js: Tests helpers for `quill`.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var fs = require('fs'),
    path = require('path'),
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

exports.latestHistory = function (system, count) {
  var historyFile = path.join(exports.dirs.installDir, system.name, 'history.json'),
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  
  return {
    history: history,
    keys: Object.keys(history).slice(-1 * count)
  };
};