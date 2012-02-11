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
    macros = require('../helpers/macros');

var shouldQuillOk = macros.shouldQuillOk;

vows.describe('quill/commands/keys').addBatch({
  'keys hostname': shouldQuillOk(
    'should respond with the hostname',
    function (err, hostname) {
      assert.isNull(err);
      assert.isString(hostname);
    }
  ),
  'hostname': shouldQuillOk(
    'should respond with the hostname',
    function (err, hostname) {
      assert.isNull(err);
      assert.isString(hostname);
    }
  )
}).export(module);