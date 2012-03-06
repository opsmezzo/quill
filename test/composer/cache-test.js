/*
 * cache-test.js: Tests for working with the composer cache.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    systemsDir = path.join(fixturesDir, 'systems'),
    placeDir = path.join(fixturesDir, 'untar'),
    cacheDir = path.join(fixturesDir, 'cache'),
    sourceDir = path.join(systemsDir, 'tgz');

vows.describe('quill/composer/dependencies').addBatch(macros.shouldInit()).addBatch({
  "When using quill.composer.cache": {
    "the addOne() method": {
      topic: function () {
        quill.config.set('directories:cache', cacheDir);
        
        quill.composer.cache.addOne({
          name: 'fixture-one', 
          version: '0.0.0',
          tarball: path.join(sourceDir, 'fixture-one.tgz')
        }, this.callback);
      },
      "should add the system to the cache": function (err, version) {
        assert.isNull(err);
        assert.isObject(version);
        assert.include(version, 'root');
        assert.include(version, 'dir');
        assert.include(version, 'tarball');
        
        assert.isObject(fs.statSync(version.root));
        assert.isObject(fs.statSync(version.dir));
        assert.isObject(fs.statSync(version.tarball));
        
        //
        // Move the tarball back
        //
        fs.renameSync(version.tarball, path.join(sourceDir, 'fixture-one.tgz'));
      }
    }
  }
}).export(module);