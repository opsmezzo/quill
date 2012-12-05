/*
 * installed-test.js: Tests for working with installed modules with quill.
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
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    systemsDir = path.join(fixturesDir, 'systems'),
    installDir = path.join(fixturesDir, 'installed'),
    sourceDir = path.join(systemsDir, 'tgz');

function assertInstalled(system) {
  assert.isString(system.path);
  assert.isTrue(fs.existsSync(system.path));
  assert.isTrue(fs.existsSync(path.join(system.path, 'system.json')));
  
  var details = helpers.latestHistory(system, 1);
  
  assert.deepEqual(details.history[details.keys[0]], {
    version: system.version,
    action: 'copy'
  });
}

function assertUninstalled(name) {
  assert.isTrue(fs.existsSync(path.join(installDir, name)));
  assert.isFalse(fs.existsSync(path.join(installDir, name, '0.0.0')));
}

vows.describe('quill/composer/installed').addBatch(
  macros.shouldInit(function () {
    helpers.cleanInstalled();
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
        assertInstalled(system)
      }
    }
  }
}).addBatch({
  "When using quill.composer.installed": {
    "the add() method": {
      topic: function () {
        quill.composer.installed.add([{
          name: 'fixture-one',
          version: '0.0.0',
          path: path.join(systemsDir, 'fixture-one')
        }, {
          name: 'fixture-two',
          version: '0.0.0',
          path: path.join(systemsDir, 'fixture-two')
        }, {
          name: 'hello-world',
          version: '0.0.0',
          path: path.join(systemsDir, 'hello-world')
        }], this.callback)
      },
      "should add all systems to the install directory": function (err, systems) {
        assert.isNull(err);
        systems.forEach(assertInstalled);
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
        assert.isObject(systems['fixture-two']);
        assert.isObject(systems['hello-world']);
      }
    }
  }
}).addBatch({
  "When using quill.composer.installed": {
    "the remove() method": {
      "with a single system": {
        topic: function () {
          quill.composer.installed.remove('fixture-one', this.callback);
        },
        "should remove the specified system": function (err) {
          assert.isTrue(!err);
          assertUninstalled('fixture-one');
        }
      },
      "with multiple systems": {
        topic: function () {
          quill.composer.installed.remove(['fixture-two', 'hello-world'], this.callback);
        },
        "should remove all specified systems": function (err) {
          assert.isTrue(!err);
          assertUninstalled('fixture-two');
          assertUninstalled('hello-world');
        }
      }
    }
  }
}).addBatch({      
  "When using quill.composer.installed": {
    "the list() method": {
      "once systems have been removed": {
        topic: function () {
          quill.composer.installed.list(this.callback)
        },
        "should respond with the list of installed systems": function (err, systems) {
          assert.isNull(err);
          assert.isObject(systems);

          ['fixture-one', 'fixture-two', 'hello-world'].forEach(function (name) {
            assert.isObject(systems[name]);
            assert.isNull(systems[name].system);
          });
        }
      }
    }
  }
}).export(module);