/*
 * installed-test.js: Tests for working with installed modules with quill.
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
    installDir = path.join(fixturesDir, 'installed'),
    sourceDir = path.join(systemsDir, 'tgz');

vows.describe('quill/composer/installed').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:install', installDir);
  })
).addBatch({
  "When using quill.composer.installed": {
    "the addOne() method": {
      topic: function () {
        quill.composer.installed.addOne({
          name: 'fixture-one',
          version: '0.0.0',
          path: path.join(systemsDir, 'fixture-one')
        }, this.callback);
      },
      "should add the system to the install directory": function (err, system) {
        assert.isNull(err);
        assert.isString(system.path);
        assert.isTrue(path.existsSync(system.path));
        assert.isTrue(path.existsSync(path.join(system.path, 'system.json')));
      }
    }
  }
}).addBatch({
  "When using quill.composer.installed": {
    "the list() method": {
      topic: function () {
        quill.composer.installed.list(this.callback)
      },
      "should respond with the list of installed systems": function (err, systems) {
        assert.isNull(err);
        assert.isObject(systems);
        assert.isObject(systems['fixture-one']);
      }
    }
  }
}).addBatch({
  "When using quill.composer.installed": {
    "the remove() method": {
      topic: function () {
        quill.composer.installed.remove('fixture-one', this.callback);
      },
      "should remove the specified system": function (err) {
        assert.isTrue(!err);
        assert.isTrue(path.existsSync(path.join(installDir, 'fixture-one')));
        assert.isFalse(path.existsSync(path.join(installDir, 'fixture-one', '0.0.0')));
      }
    }
  }
}).export(module);