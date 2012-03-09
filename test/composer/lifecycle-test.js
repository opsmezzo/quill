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
    cacheDir = path.join(fixturesDir, 'cache');

function assertScriptOutput(actual, expected) {
  assert.equal(actual.name, expected);
  assert.equal(actual.data, fs.readFileSync(
    path.join(systemsDir, expected, 'files', expected + '.txt'),
    'utf8'
  ));
}

vows.describe('quill/composer/lifecycle').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
  })
).addBatch({
  "When using quill.composer": {
    "the runOne() method": {
      topic: function () {
        var that = this;
        
        quill.on(['run', '*', 'stdout'], function (system, data) {
          that.data = data.toString();
        })
        
        quill.composer.runOne('bootstrap', {
          path: path.join(systemsDir, 'fixture-one')
        }, this.callback);
      },
      "should run the target script successfully": function (err, _) {
        assert.isNull(err);
        assert.equal(this.data, fs.readFileSync(
          path.join(systemsDir, 'fixture-one', 'files', 'fixture-one.txt'),
          'utf8'
        ));
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
        
        mock.systems.local(api, function () {        
          quill.composer.run('bootstrap', 'hello-world', that.callback);
        });
      },
      "should run the specified scripts": function (err, systems) {
        assert.isNull(err);
                
        assertScriptOutput(this.data[0], 'fixture-one');
        assertScriptOutput(this.data[1], 'fixture-two');
        assertScriptOutput(this.data[2], 'hello-world');
      }
    }
  }
}).export(module);