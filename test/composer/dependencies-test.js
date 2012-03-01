/*
 * dependencies-test.js: Tests for working with dependency trees.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    quill = require('../../lib/quill');

vows.describe('quill/composer/dependencies').addBatch(macros.shouldInit()).addBatch({
  "When using quill.composer": {
    "the dependencies() method": macros.shouldAnalyzeDeps(
      macros.shouldFindDeps
    )
  }
}).export(module);