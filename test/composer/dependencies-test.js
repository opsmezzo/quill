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
    "the dependencies() method": macros.shouldAnalyzeDeps(
      macros.shouldFindDeps
    ),
    "the runlist() method": macros.shouldAnalyzeDeps(
      macros.shouldMakeRunlist
    ),
    "the remoteRunlist() method": {
      "hello-remote-deps": {
        topic: function () {
          var api = nock('http://api.testquill.com');
          mock.systems.all(api);

          quill.composer.remoteRunlist({
            systems: ['hello-remote-deps']
          }, this.callback);
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