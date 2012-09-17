/*
 * lifecycle-test.js: Tests for system lifecycle scripts.
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
    cacheDir = path.join(fixturesDir, 'cache');

function assertHistory(action, system) {
  var details = helpers.latestHistory(system, 2),
      history = details.history,
      keys = details.keys;
  
  assert.deepEqual(history[keys[0]], {
    action: action,
    version: system.version,
    time: 'start'
  });
  
  assert.deepEqual(history[keys[1]], {
    action: action,
    version: system.version,
    time: 'end'
  });
}

vows.describe('quill/composer/lifecycle').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
    quill.config.set('directories:install', installDir);
  })
).addBatch({
  "When using quill.composer": {
    "the runOne() method": {
      topic: function () {
        var that = this;
        
        quill.on(['run', '*', 'stdout'], function (system, data) {
          that.data = data.toString();
        })
        
        quill.composer.runOne('install', {
          name: 'fixture-one',
          version: '0.0.0',
          history: {},
          path: path.join(systemsDir, 'fixture-one')
        }, this.callback);
      },
      "should run the target script successfully": function (err, _) {
        assert.isNull(err);
        assert.equal(this.data, fs.readFileSync(
          path.join(systemsDir, 'fixture-one', 'files', 'fixture-one.txt'),
          'utf8'
        ));
        
        assertHistory('install', {
          name: 'fixture-one',
          version: '0.0.0'
        });
      }
    }
  }
}).addBatch({
  "When using quill.composer": {
    "the run() method": {
      topic: function () {
        var api = nock('http://api.testquill.com'),
            that = this;

        that.data = [];
        quill.on(['run', '*', 'stdout'], function (system, data) {
          that.data.push({
            name: system.name, 
            data: '' + data
          });
        });
        
        helpers.cleanInstalled();
        mock.systems.local(api, function () {        
          quill.composer.run('install', 'hello-world', that.callback);
        });
      },
      "should run the specified scripts": function (err, systems) {
        assert.isNull(err);
                
        helpers.assertScriptOutput(this.data[0], 'fixture-one');
        helpers.assertScriptOutput(this.data[1], 'fixture-two');
        helpers.assertScriptOutput(this.data[2], 'hello-world');
        
        assertHistory('install', {
          name: 'hello-world',
          version: '0.0.0'
        });
      }
    }
  }
}).export(module);
