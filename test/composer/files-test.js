/*
 * list-files-test.js: Tests for utility functions related to listing files and working with ignores.
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
      
      quill.composer.listFiles(target, { path: target }, this.callback);
    },
    "should ignore the correct files": function (err, files) {
      assert.isNull(err);
      assert.lengthOf(files.filter(function (file) {
        return pattern.test(file);
      }), 0);
    }
  }
}

vows.describe('quill/composer/files').addBatch({
  "When using quill.composer": {
    "the readJson() method": {
      "with a system containing /template": {
        topic: function () {
          var target = this.target = path.join(systemsDir, 'hello-world');
          quill.composer.readJson(target, this.callback);
        },
        "should respond with the correct system.json": function (err, system) {
          assert.isNull(err);
          assert.isObject(system);
          assert.isArray(system.files);
          assert.include(system.files, 'hello-world.txt');
          assert.isArray(system.scripts);
          assert.include(system.scripts, 'install.sh');
          assert.isArray(system.templates);
          assert.include(system.templates, 'template.conf');
        }
      }
    },
    "the listFiles() method": {
      "with a system containing .quillignore": shouldIgnore('quillignore', /quill-ignored/),
      "with a system containing .gitignore": shouldIgnore('gitignore', /git-ignored/),
      "with ubuntu-base": {
        topic: function () {
          var target = this.target = path.join(systemsDir, 'hello-world');

          quill.composer.listFiles(target, { path: target }, this.callback);
        },
        "should have the correct files": function (err, files) {
          assert.isNull(err);
          
          var that = this;
          files = files.map(function (file) {
            return file.replace(that.target, '').slice(1);
          }).filter(Boolean);
          
          ['files/hello-world.txt',
           'files',
           'scripts/install.sh',
           'scripts',
           'templates',
           'templates/template.conf',
           'system.json'].forEach(function (file) {
             assert.notEqual(files.indexOf(file), -1);
           })
        }
      }
    }
  }
}).export(module);