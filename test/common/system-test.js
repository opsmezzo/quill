/*
 * system-test.js: Tests for utility functions related to packaging systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    quill = require('../../lib/quill');

var systemsDir = path.join(__dirname, '..', 'fixtures', 'systems');

function shouldIgnore(system, pattern) {
  return {
    topic: function () {
      var target = path.join(systemsDir, system);
      
      quill.common.system.listFiles(target, { path: target }, this.callback);
    },
    "should ignore the correct files": function (err, files) {
      assert.isNull(err);
      assert.lengthOf(files.filter(function (file) {
        return pattern.test(file);
      }), 0);
    }
  }
}

vows.describe('quill/common/systems').addBatch({
  "When using quill.common.systems": {
    "the listFiles() method": {
      "with a directory containing .quillignore": shouldIgnore('quillignore', /quill-ignored/),
      "with a directory containing .gitignore": shouldIgnore('gitignore', /git-ignored/),
      "with ubuntu-base": {
        topic: function () {
          var target = this.target = path.join(systemsDir, 'ubuntu-base');

          quill.common.system.listFiles(target, { path: target }, this.callback);
        },
        "should have the correct files": function (err, files) {
          assert.isNull(err);
          
          var that = this;
          files = files.map(function (file) {
            return file.replace(that.target, '').slice(1);
          }).filter(Boolean);
          
          ['files/gmond.conf',
           'files/template',
           'files',
           'scripts/bootstrap.sh',
           'scripts',
           'system.json'].forEach(function (file) {
             assert.notEqual(files.indexOf(file), -1);
           })
        }
      }
    }
  }
}).export(module);