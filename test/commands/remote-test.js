var assert = require('assert'),
    nock = require('nock'),
    vows = require('vows'),
    common = require('flatiron').common,
    macros = require('../helpers/macros'),
    quill = require('../../lib/quill'),
    testConfig = require('../fixtures/configs/test-config.json');

var shouldQuillOk = macros.shouldQuillOk;

vows.describe('quill/commands/remote').addBatch({
  'remote view test-config': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .get('/config/test-config')
      .reply(200, {
        config: {
          resource: 'Config',
          name: 'test-config',
          settings: {
            foo: 'bazz'
          }
        }
      });
  })
}).addBatch({
  'remote create test-config': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .post('/config/test-config', {})
      .reply(201);
  })
}).addBatch({
  'remote delete test-config': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .delete('/config/test-config')
      .reply(200);
  })
}).addBatch({
  'remote list': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .get('/config')
      .reply(200, {
        config: [
          {
            resource: 'Config',
            name: 'test-config',
            settings: {
              foo: 'bazz'
            }
          },
          {
            resource: 'Config',
            name: 'second-test-config',
            settings: {}
          }
        ]
      });
  })
}).addBatch({
  'remote set test-config key value': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .put('/config/test-config/key', '"value"')
      .reply(200);
  })
}).addBatch({
  'remote clear test-config key': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .delete('/config/test-config/key')
      .reply(200);
  })
}).addBatch({
  'remote load test-config test/fixtures/configs/test-config.json': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .delete('/config/test-config')
      .reply(200)
      .post('/config/test-config', testConfig)
      .reply(201);
  })
}).addBatch({
  'remote merge test-config test/fixtures/configs/test-config.json': shouldQuillOk(function setup() {
    var original = {
      settings: {
        config: {
          some: 'modification'
        },
        'I': ['just', 'merged', 'you']
      }
    };

    var merged = common.clone(original);

    Object.keys(testConfig).forEach(function (key) {
      merged.settings[key] = testConfig[key];
    });

    nock('http://api.testquill.com')
      .get('/config/test-config')
      .reply(200, { config: original })
      .delete('/config/test-config')
      .reply(200)
      .post('/config/test-config', merged.settings)
      .reply(201);
  })
}).export(module);
