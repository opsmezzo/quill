var assert = require('assert'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
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
        assert.deepEqual(config, {
          quill_foo: 'baz',
          quill_bar: 'lol',
          quill_nested_boo: 'faz'
        });
      }
    }
  }
}).addBatch({
  'When using `quill.composer`': {
    'the `run()` method with config specified': {
      topic: function () {
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

        quill.argv.config = ['test-config', 'foo=bar'];

        self.data = '';
        quill.on(['run', '*', 'stdout'], function (system, data) {
          self.data += data.toString();
        });

        helpers.cleanInstalled(['config']);
        mock.systems.local(api, function () {
          quill.composer.run('install', 'config', self.callback);
        });
      },
      'should output correct data': function (err, _) {
        assert.isNull(err);
        assert.deepEqual(JSON.parse(this.data), {
          quill_foo: 'bar',
          quill_baz: 'foo'
        });
      }
    }
  }
}).export(module);
