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

var fixturesDir = helpers.dirs.fixtures,
    systemsDir  = helpers.dirs.systems,
    cacheDir    = helpers.dirs.cache,
    placeDir    = path.join(fixturesDir, 'untar'),
    sourceDir   = path.join(systemsDir, 'tgz');

vows.describe('quill/composer/cache').addBatch(
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
    "the addOne() method": {
      "with a new system": macros.shouldAddOne(sourceDir, {
        name: 'fixture-one', 
        version: '0.0.0',
        tarball: 'fixture-one.tgz'
      })
    }
  }
}).addBatch({
  "When using quill.composer.cache": {
    "the addOne() method": {
      "with an existing system": macros.shouldAddOne(sourceDir, {
        name: 'fixture-one', 
        version: '0.0.0',
        tarball: 'fixture-one.tgz'
      }),
      "with a new system": macros.shouldAddOne(sourceDir, {
        name: 'fixture-two', 
        version: '0.0.0',
        tarball: 'fixture-two.tgz'
      })
    }
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
    "the add() method": {
      "with a system that is already cached": {
        topic: function () {
          //
          // Note: We are NOT setting up API mock here because the
          // API SHOULD NOT BE HIT because THIS ALREADY EXISTS IN THE CACHE.
          //
          quill.composer.cache.add({
            systems: [{
              name: 'fixture-one',
              version: '0.0.0'
            }]
          }, this.callback);
        },
        "add the system to the cache": function (err, versions) {
          assert.isNull(err);
          assert.isArray(versions);
          assert.lengthOf(versions, 1);

          var files = fs.readdirSync(cacheDir);

          versions.forEach(function (version) {
            assert.include(files, version.name);

            try { var system = JSON.parse(fs.readFileSync(path.join(version.cached, 'system.json'))) }
            catch (ex) { assert.isNull(ex) }

            assert.isObject(system);
            assert.equal(version.name, system.name);
          });
        }
      },
      "with some systems that are cached": {
        topic: function () {
          var api = nock('http://api.testquill.com'),
              that = this;

          mock.systems.local(api, function () {
            quill.composer.cache.add({
              systems: [{
                name: 'hello-world',
                version: '0.0.0'
              }, {
                name: 'fixture-two',
                version: '0.0.0'
              }]
            }, that.callback);
          });
        },
        "add the system to the cache": function (err, versions) {
          assert.isNull(err);
          assert.isArray(versions);
          assert.lengthOf(versions, 2);

          var files = fs.readdirSync(cacheDir);

          versions.forEach(function (version) {
            assert.include(files, version.name);

            try { var system = JSON.parse(fs.readFileSync(path.join(version.cached, 'system.json'))) }
            catch (ex) { assert.isNull(ex) }

            assert.isObject(system);
            assert.equal(version.name, system.name);
          });
        }
      }
    }
  }
}).addBatch({
  "When using quill.composer.cache": {
    "the clean() method": {
      "when removing named systems": {
        topic: function () {
          quill.composer.cache.clean(['hello-world', 'fixture-one', 'fixture-two'], this.callback);
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
          quill.composer.cache.add({
            systems: [{
              name: 'hello-world',
              version: '0.0.0'
            }]
          }, that.callback);
        });
      },
      "add the system to the cache": function (err, versions) {
        assert.isNull(err);
        assert.isArray(versions);
        assert.lengthOf(versions, 1);
        
        var files = fs.readdirSync(cacheDir);
        
        versions.forEach(function (version) {
          assert.include(files, version.name);
          
          try { var system = JSON.parse(fs.readFileSync(path.join(version.cached, 'system.json'))) }
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
