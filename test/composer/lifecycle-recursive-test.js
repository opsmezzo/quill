var assert = require('assert'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var shouldQuillOk = macros.shouldQuillOk,
    fixturesDir = path.join(__dirname, '..', 'fixtures'),
    installDir = path.join(fixturesDir, 'installed'),
    cacheDir = path.join(fixturesDir, 'cache');

vows.describe('quill/composer/lifecycle/recursive').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
    quill.config.set('directories:install', installDir);
  })
).addBatch({
  'A system that has dependencies with uninstall but no uninstall script': {
    'uninstall hello-world': shouldQuillOk(
      function setup(callback) {
        var api = nock('http://api.testquill.com'),
            that = this;

        quill.on(['run', 'stdout'], function (system, data) {
          that.data = data;
        });

        helpers.cleanInstalled(['hello-world', 'fixture-one', 'fixture-two']);
        mock.systems.local(api, callback);
      },
      'should not run any lifecycle action scripts',
      function (err, _) {
        assert.isNull(err);
        assert.isTrue(typeof this.data === 'undefined');
      }
    )
  }
}).addBatch({
  'A system that has dependencies': {
    'configure hello-world': shouldQuillOk(
      function setup(callback) {
        var api = nock('http://api.testquill.com'),
            that = this;

        that.data = [];
        quill.on(['run', 'stdout'], function (system, data) {
          that.data.push({
            name: system.name,
            data: '' + data
          });
        });

        helpers.cleanInstalled(['hello-world', 'fixture-one', 'fixture-two']);
        mock.systems.local(api, callback);
      },
      'should run `install` and `configure` lifecycle action scripts recursively',
      function (err, _) {
        assert.isNull(err);
        assert.deepEqual(
          ['fixture-one', 'fixture-one',
           'fixture-two', 'fixture-two',
           'hello-world', 'hello-world'],
          this.data.map(function (info) {
            return info.name
          })
        )
      }
    )
  }
}).export(module);
