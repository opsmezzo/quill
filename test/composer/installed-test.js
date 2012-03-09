/*
 * installed-test.js: Tests for working with installed modules with quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    common = require('flatiron').common,
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    systemsDir = path.join(fixturesDir, 'systems'),
    installDir = path.join(fixturesDir, 'install'),
    sourceDir = path.join(systemsDir, 'tgz');

vows.describe('quill/composer/installed').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:install', installDir);
  })
)