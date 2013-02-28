/*
 * systems-test.js: Tests for `quill systems *` commands.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    os = require('os'),
    common = require('flatiron').common,
    rimraf = common.rimraf,
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var shouldQuillOk = macros.shouldQuillOk,
    systemsDir = path.join(__dirname, '..', 'fixtures', 'systems'),
    startDir = process.cwd();

vows.describe('quill/commands/installed').addBatch({
  'installed list': shouldQuillOk()
}).addBatch({
  "latest hello-world": shouldQuillOk(
    function setup(callback) {
      var api = nock('http://api.testquill.com'),
          self = this;

      mock.systems.local(api, {
        'fixture-one': {
          requests: 2,
          versions: ['0.0.1', '0.1.0']
        },
        'fixture-two': {
          requests: 2,
          versions: ['0.0.1', '0.1.0']
        }
      }, callback);
    },
    'should install the system correctly',
    function (err, latest) {
      assert.isNull(err);
      assert.deepEqual(latest, {
        'fixture-one': '0.0.1',
        'fixture-two': '0.0.1'
      })
    }
  )
}).export(module);
