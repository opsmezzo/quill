/*
 * dependencies-test.js: Tests for working with dependency trees and runlists.
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

vows.describe('quill/composer/dependencies').addBatch(macros.shouldInit()).addBatch({
  "When using quill.composer": {
    "calculating dependencies": macros.shouldAnalyzeAllDeps(),
    "the remoteRunlist() method": {
      "hello-remote-deps": {
        topic: function () {
          var api  = nock('http://api.testquill.com'),
              that = this;

          mock.systems.all(api);
          quill.composer.dependencies('hello-remote-deps', function (err, deps) {
            return that.callback(err, err || quill.composer.remoteRunlist({
              systems: deps
            }));
          });
        },
        "should respond with the correct remoteRunlist": function (err, remoteRunlist) {
          assert.isNull(err);
          assert.lengthOf(remoteRunlist, 1);

          var fixtureOne = remoteRunlist[0];
          assert.equal(fixtureOne.name, 'fixture-one');
          assert.equal(fixtureOne.version, '0.0.0');
          assert.equal(fixtureOne.semver, '0.0.x');
        }
      }
    }
  }
}).export(module);