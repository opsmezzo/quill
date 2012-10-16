var assert = require('assert'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

vows.describe('quill/composer/lifecycle/reinstall').addBatch(
  macros.shouldInit()
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
}).export(module);
