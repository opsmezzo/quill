/*
 * index.js: Tests helpers for `quill`.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    common = require('flatiron').common,
    rimraf = common.rimraf,
    quill = require('../../lib/quill');

//
// Setup test directories
//
exports.dirs             = {};
exports.dirs.fixtures = path.join(__dirname, '..', 'fixtures');
exports.dirs.systems  = path.dirname(require.resolve('system.json/test/fixtures'));
exports.dirs.install  = path.join(exports.dirs.fixtures, 'installed');
exports.dirs.cache    = path.join(exports.dirs.fixtures, 'cache');
exports.dirs.ssl         = path.join(exports.dirs.fixtures, 'ssl');

exports.init = function (callback) {
  quill.config.stores.file.file = path.join(__dirname, '..', 'fixtures', 'dot-quillconf');
  quill.config.stores.file.loadSync();
  
  quill.init(quill.setup.bind(quill, callback));
};

exports.cleanInstalled = function (systems) {
  try {
    var installDir = exports.dirs.install;
    
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
  var historyFile = path.join(exports.dirs.install, system.name, 'history.json'),
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  
  return {
    history: history,
    keys: Object.keys(history).slice(-1 * count)
  };
};

exports.assertScriptOutput = function (actual, expected) {
  assert.isObject(actual);
  assert.equal(actual.name, expected);
  assert.equal(actual.data, fs.readFileSync(
    path.join(exports.dirs.systems, expected, 'files', expected + '.txt'),
    'utf8'
  ));
};
