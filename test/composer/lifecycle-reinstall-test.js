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

vows.describe('quill/composer/lifecycle/reinstall').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
    quill.config.set('directories:install', installDir);
  })
).addBatch({
  'When using `quill.composer`': {
    'the `run()` method called for the first time': {
      'install uninstall': shouldQuillOk(
        function setup(callback) {
          var api = nock('http://api.testquill.com'),
              self = this;

          self.data = '';
          quill.on(['run', 'stdout'], function (system, data) {
            self.data += data.toString();
          });

          helpers.cleanInstalled(['uninstall']);
          mock.systems.local(api, callback);
        },
        'should install the system correctly',
        function (err, _) {
          assert.isNull(err);
          assert.equal(this.data, 'Installing uninstall\n');
        }
      )
    }
  }
}).addBatch({
  'When using `quill.composer`': {
    'the `run()` method called for the second time': {
      'install uninstall': shouldQuillOk(
        function setup(callback) {
          var api = nock('http://api.testquill.com'),
              self = this;

          quill.argv.force = true;
          self.data = '';
          quill.on(['run', 'stdout'], function (system, data) {
            self.data += data.toString();
          });

          mock.systems.local(api, callback);
        },
        'should run `uninstall` and `install`',
        function (err, _) {
          assert.isNull(err);
          assert.equal(this.data, 'Uninstalling uninstall\nInstalling uninstall\n');
        }
      )
    }
  }
}).addBatch({
  'When using `quill.composer`': {
    'called for the third time with `--force` disabled': {
      'install uninstall': shouldQuillOk(
        function setup(callback) {
          var api = nock('http://api.testquill.com'),
              self = this;

          quill.argv.force = false;

          self.data = '';
          quill.on(['run', 'stdout'], function (system, data) {
            self.data += data.toString();
          });

          mock.systems.local(api, callback);
        },
        'shouldn\'t do anything',
        function (err, _) {
          assert.isNull(err);
          assert.equal(this.data, '');
        }
      )
    }
  }
}).export(module);
