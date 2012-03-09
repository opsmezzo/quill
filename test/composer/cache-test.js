/*
 * cache-test.js: Tests for working with the composer cache.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    common = require('flatiron').common,
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    systemsDir = path.join(fixturesDir, 'systems'),
    placeDir = path.join(fixturesDir, 'untar'),
    cacheDir = path.join(fixturesDir, 'cache'),
    sourceDir = path.join(systemsDir, 'tgz');

vows.describe('quill/composer/dependencies').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
  })
).addBatch({
  "When using quill.composer.cache": {
    "the clean() method": {
      "when removing all systems": {
        topic: function () {
          quill.composer.cache.clean(this.callback);
        },
        "should remove all files from the cache": function (err) {
          assert.isTrue(!err);
          assert.lengthOf(fs.readdirSync(cacheDir), 1);
        }
      }
    }
  }
}).addBatch({
  "When using quill.composer.cache": {
    "the addOne() method": macros.shouldAddOne(sourceDir, {
      name: 'fixture-one', 
      version: '0.0.0',
      tarball: 'fixture-one.tgz'
    })
  }
}).addBatch({
  "When using quill.composer.cache": {
    "the addOne() method": macros.shouldAddOne(sourceDir, {
      name: 'fixture-two', 
      version: '0.0.0',
      tarball: 'fixture-two.tgz'
    })
  }
}).addBatch({
  "When using quill.composer.cache": {
    "the list() method": {
      topic: function () {
        quill.composer.cache.list(this.callback);
      },
      "should respond with all systems in the cache": function (err, cache) {
        assert.isNull(err);
        assert.isObject(cache);
        assert.isArray(cache['fixture-one'])
        assert.lengthOf(cache['fixture-one'], 1);
        assert.isArray(cache['fixture-two'])
        assert.lengthOf(cache['fixture-two'], 1);
      }
    }
  }
}).addBatch({
  "When using quill.composer.cache": {
    "the clean() method": {
      "when removing named systems": {
        topic: function () {
          quill.composer.cache.clean(['fixture-one', 'fixture-two'], this.callback);
        },
        "should remove all files from the cache": function (err) {
          assert.isTrue(!err);
          assert.lengthOf(fs.readdirSync(cacheDir), 1);
        }
      }
    }
  }
}).addBatch({
  "When using quill.composer.cache": {
    "the add() method": {
      topic: function () {
        var api = nock('http://api.testquill.com'),
            that = this;
        
        mock.systems.local(api, function () {
          quill.composer.cache.add('hello-world', that.callback);
        });
      },
      "add the system and all dependencies to the cache": function (err, versions) {
        assert.isNull(err);
        assert.isArray(versions);
        assert.lengthOf(versions, 3);
        
        var files = fs.readdirSync(cacheDir);
        
        versions.forEach(function (version) {
          assert.include(files, version.name);
          
          try { var system = JSON.parse(fs.readFileSync(path.join(version.path, 'system.json'))) }
          catch (ex) { assert.isNull(ex) }
          
          assert.isObject(system);
          assert.equal(version.name, system.name);
        });
      }
    }
  }
}).addBatch({
  "When using quill.composer.cache": {
    "the clean() method": {
      "when removing all systems": {
        topic: function () {
          quill.composer.cache.clean(this.callback);
        },
        "should remove all files from the cache": function (err) {
          assert.isTrue(!err);
          assert.lengthOf(fs.readdirSync(cacheDir), 1);
        }
      }
    }
  }
}).export(module);