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
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    systemsDir = path.join(fixturesDir, 'systems');

vows.describe('quill/composer/lifecycle').addBatch(macros.shouldInit()).addBatch({
  "When using quill.composer": {
    "the runOne() method": {
      topic: function () {
        var that = this;
        
        quill.on(['run', '*', 'stdout'], function (data) {
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
}).export(module);