/*
 * tar-test.js: Tests for working with tarballs.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    common = require('flatiron').common,
    async = common.async,
    rimraf = common.rimraf,
    readDirFiles = require('read-dir-files'),
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    systemsDir = path.join(fixturesDir, 'systems'),
    placeDir = path.join(fixturesDir, 'untar');

//
// Remove any existing untared directories for idempotency.
//
fs.readdirSync(placeDir).filter(function (file) {
  return fs.statSync(path.join(placeDir, file)).isDirectory();
}).forEach(function (dir) {
  try { rimraf.sync(path.join(placeDir, dir)); }
  catch (err) { }
});

function assertIncludesAll(base, target) {
  for (var i = 0; i < base.length; i++) {
    assert.include(base, target[i]);
  }
}

vows.describe('quill/composer/tar').addBatch({
  "When using quill.composer": {
    "the tar.unpack() method": {
      topic: function () {
        quill.composer.unpack(
          path.join(systemsDir, 'redis.tgz'),
          placeDir,
          null,
          this.callback
        );
      },
      "should create the correct director": function (err, target) {
        assert.isNull(err);
        assert.isTrue(target.indexOf('/redis') !== -1)
      },
      "should extract the correct files": {
        topic: function () {
          async.map([
            path.join(placeDir, 'redis'),
            path.join(systemsDir, 'redis')
          ], function (dir, next) {
            readDirFiles.list(dir, { normalize: false }, next)
          }, this.callback);
        },
        "which match the fixture files": function (err, lists) {
          assert.isNull(err);
          assertIncludesAll(lists[0], lists[1]);
        }
      }
    }
  }
}).export(module);