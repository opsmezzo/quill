/*
 * keys-test.js: Tests for `quill keys *` commands.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    macros = require('../helpers/macros'),
    quill = require('../../lib/quill');

var shouldQuillOk = macros.shouldQuillOk;

var keys = [
  '0123456789', 
  '1234567890',
  '2345678991'
];

var appendKeys = [
  'abcdefghij',
  'klmnopqrst'
];

function assertWroteKeys(target) {
  return function (_, err) {
    assert.isTrue(!err);
    
    var written = fs.readFileSync(quill.common.authorizedKeys.filename, 'utf8')
      .split('\n')
      .filter(Boolean);
      
    target.forEach(function (key) {
      assert.notEqual(written.indexOf(key), -1);
    });
  }
}

//
// Remove any existing keys for test idempotency.
//
try { fs.unlinkSync(quill.common.authorizedKeys.filename) }
catch (ex) { }

vows.describe('quill/commands/keys').addBatch({
  'keys hostname': shouldQuillOk(
    'should respond with the hostname',
    function (err, hostname) {
      assert.isNull(err);
      assert.isString(hostname);
    }
  )
}).addBatch({
  'hostname': shouldQuillOk(
    'should respond with the hostname',
    function (err, hostname) {
      assert.isNull(err);
      assert.isString(hostname);
    }
  )
}).addBatch({
  'keys authorize-all': shouldQuillOk(
    'should write the correct keys to disk',
    assertWroteKeys(keys),
    function setup() {
      quill.prompt.override['yesno'] = 'y';
    
      nock('http://api.testquill.com')
        .get('/keys')
        .reply(200, { keys: keys })
    }
  )
}).addBatch({
  'keys authorize devjitsu': shouldQuillOk(
    'should append the correct keys to disk',
    assertWroteKeys(keys.concat(appendKeys)),
    function setup() {
      nock('http://api.testquill.com')
        .get('/keys/devjitsu')
        .reply(200, { keys: appendKeys })
    }
  )
}).export(module);