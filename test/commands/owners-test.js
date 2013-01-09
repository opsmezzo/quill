var assert = require('assert'),
    nock = require('nock'),
    vows = require('vows'),
    common = require('flatiron').common,
    macros = require('../helpers/macros'),
    quill = require('../../lib/quill'),
    testConfig = require('../fixtures/configs/test-config.json');

var shouldQuillOk = macros.shouldQuillOk;

vows.describe('quill/commands/owners').addBatch({
  'owners ls system-name': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .get('/systems/system-name')
      .reply(200, {
        system: {
          maintainers: ['devjitsu', 'quill-foo']
        }
      });
  })
}).addBatch({
  'owners add system-name user': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .put('/systems/system-name/owners', ['user'])
      .reply(204);
  })
}).addBatch({
  'owners rm system-name user': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .delete('/systems/system-name/owners', ['user'])
      .reply(204);
  })
}).addBatch({
  'owners rm': shouldQuillOk(
    'should respond with an error',
    function (_, err) {
      assert.isTrue(err);
    }
  )
}).addBatch({
  'owners ls': shouldQuillOk(
    'should respond with an error',
    function (_, err) {
      assert.isTrue(err);
    }
  )
}).addBatch({
  'owners add': shouldQuillOk(
    'should respond with an error',
    function (_, err) {
      assert.isTrue(err);
    }
  )
}).export(module);
