/*
 * runlist-test.js: Tests for working with runlists.
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

vows.describe('quill/composer/runlist').addBatch(macros.shouldInit()).addBatch({
  "When using quill.composer": {
    "the dependencies() method": {
      "with a no dependencies": macros.shouldMakeRunlist('no-deps'),
      "with a single dependency (implicit runlist)": macros.shouldMakeRunlist('single-dep'),
      "with multiple dependencies": macros.shouldMakeRunlist('depends-on-a-b'),
      "with a dependency in a dependency": macros.shouldMakeRunlist('dep-in-dep'),
      "with a single OS dependency": macros.shouldMakeRunlist('single-ubuntu-dep', 'ubuntu')
    }
  }
}).export(module);