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
  "With missing remotes": {
    "configure config": shouldQuillOk(
      function setup(callback) {
        var api = nock('http://api.testquill.com');

        api.get('/config/missing-config')
          .reply(404);

        quill.argv.config = ['missing-config'];
        helpers.cleanInstalled(['config']);
        mock.systems.local(api, callback);
      },
      'should respond with the correct error',
      function (err, _) {
        assert.isObject(err);
        assert.match(err.message, /Error fetching configs missing-config/);
      }
    )
  }
}).addBatch({
  "With missing config values": {
    "configure config": shouldQuillOk(
      function setup(callback) {
        var api = nock('http://api.testquill.com');

        api.get('/config/missing-config')
          .reply(200, {
            config: {
              resource: 'Config',
              name: 'missing-config',
              settings: {
                foo: 'bazz',
                baz: 'foo'
              }
            }
          });

        quill.argv.config = ['missing-config'];
        helpers.cleanInstalled(['config']);
        mock.systems.local(api, callback);
      },
      'should respond with the correct error',
      function (err, _) {
        assert.isObject(err);
        assert.match(err.message, /Missing configuration value: nested/);
      }
    )
  }
}).addBatch({
  "With all config values": {
    "configure config": shouldQuillOk(
      function setup(callback) {
        var api = nock('http://api.testquill.com'),
            self = this;

        api.get('/config/test-config')
          .reply(200, {
            config: {
              resource: 'Config',
              name: 'test-config',
              settings: {
                foo: 'bazz',
                baz: 'foo',
                index: 1,
                nested: {
                  val: 42,
                  foo: 42
                },
                list: [
                  'first',
                  'second'
                ]
              }
            }
          });

        quill.argv.config = ['test-config', 'foo=bar'];
        self.data = '';
        quill.on(['run', 'stdout'], function (system, data) {
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
            quill_index: 1,
            quill_nested_val: 42,
            quill_nested_foo: 42,
            quill_list_0: 'first',
            quill_list_1: 'second',
            q_foo: 'bar',
            q_baz: 'foo',
            q_index: 1,
            q_nested_val: 42,
            q_nested_foo: 42,
            q_list_0: 'first',
            q_list_1: 'second'
          },
          file: [
            'foo is bar',
            'This should be an object: {\n  "val": 42,\n  "foo": 42\n}',
            'This should template inside out: 42',
            'This should index into a list: first',
            'This should index into a list inside out: second'
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
