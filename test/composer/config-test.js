var assert = require('assert'),
    os = require('os'),
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

vows.describe('quill/composer/config').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
    quill.config.set('directories:install', installDir);
  })
).addBatch({
  'When using `quill.composer.config`': {
    'the `getEnv()` method': {
      topic: function () {
        nock('http://api.testquill.com')
          .get('/config/first')
          .reply(200, {
            config: {
              resource: 'Config',
              name: 'first',
              settings: {
                foo: 'bar',
                nested: {
                  boo: 'faz'
                }
              }
            }
          });

        quill.argv.config = ['first', 'foo=baz'];
        quill.composer.config.getEnv({
          config: {
            bar: 'lol'
          }
        }, this.callback);
      },
      'should return correct config': function (err, config) {
        assert(!err);

        var expected = {
          quill_foo: 'baz',
          quill_bar: 'lol',
          quill_nested_boo: 'faz'
        };

        Object.keys(expected).forEach(function (key) {
          assert.isString(expected[key], config[key]);
          assert.equal(expected[key], config[key]);
        });
      }
    }
  }
}).addBatch({
  'When using `quill.composer`': {
    'the `osConfig()` method': {
      topic: quill.composer.config.osConfig(),
      "should have the correct values": function (config) {
        assert.isObject(config.os);

        ['hostname',
        'type',
        'platform',
        'arch',
        'release'].forEach(function (key) {
          assert.equal(config.os[key], os[key]());
        });

        assert.equal(config.os.cpus, os.cpus().length);
        assert.isObject(config.os.networkInterfaces);
        Object.keys(config.os.networkInterfaces).forEach(function (name) {
          assert.isObject(config.os.networkInterfaces[name]);
          assert.isArray(config.os.networkInterfaces[name].ipv4);
          assert.isArray(config.os.networkInterfaces[name].ipv6);
        });
      }
    }
  }
}).addBatch({
  "With missing config values": {
    "install config": shouldQuillOk(
      function setup(callback) {
        var api = nock('http://api.testquill.com'),
            self = this;

        api
          .get('/config/test-config')
          .reply(200, {
            config: {
              resource: 'Config',
              name: 'test-config',
              settings: {
                foo: 'bazz',
                baz: 'foo'
              }
            }
          });

        quill.argv.config = ['test-config'];
        helpers.cleanInstalled(['config']);
        mock.systems.local(api, callback);
      },
      'should output correct data',
      function (err, _) {
        assert.isObject(err);
        assert.match(err.message, /Missing configuration value: nested/);
      }
    )
  }
}).addBatch({
  "With all config values": {
    "install config": shouldQuillOk(
      function setup(callback) {
        var api = nock('http://api.testquill.com'),
            self = this;

        api
          .get('/config/test-config')
          .reply(200, {
            config: {
              resource: 'Config',
              name: 'test-config',
              settings: {
                foo: 'bazz',
                baz: 'foo',
                nested: {
                  val: 42
                }
              }
            }
          });

        quill.argv.config = ['test-config', 'foo=bar'];
        self.data = '';
        quill.on(['run', '*', 'stdout'], function (system, data) {
          self.data += data.toString();
        });

        helpers.cleanInstalled(['config']);
        mock.systems.local(api, callback);
      },
      'should output correct data',
      function (err, _) {
        assert.isNull(err);

        var config = JSON.parse(this.data);
        var expected = {
          env: {
            quill_foo: 'bar',
            quill_baz: 'foo',
            quill_nested_val: 42,
            q_foo: 'bar',
            q_baz: 'foo',
            q_nested_val: 42
          },
          file: [
            'foo is bar',
            'This should be an object: {\n  "val": 42\n}\n'
          ].join('\n')
        };

        assert.equal(expected.file, config.file);
        Object.keys(expected.env).forEach(function (key) {
          assert.equal(expected.env[key], config.env[key]);
        });

        delete quill.argv.config;
      }
    )
  }
}).export(module);
