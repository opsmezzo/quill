/*
 * systems-test.js: Tests for `quill systems *` commands.
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

var shouldQuillOk = macros.shouldQuillOk,
    systemsDir = path.join(__dirname, '..', 'fixtures', 'systems');

//
// Remove any existing tarballs for idempotency.
//
fs.readdirSync(systemsDir).filter(function (file) {
  return path.extname(file) === '.tgz';
}).forEach(function (tarball) {
  try { fs.unlinkSync(path.join(systemsDir, tarball)); }
  catch (err) { }
});

//
// Helper function which asserts that the context creates
// the target `tarball`.
//
function shouldPackage(tarball) {
  return shouldQuillOk(
    'should create the specified tarball',
    function (_, err) {
      assert.ok(path.existsSync(path.join(systemsDir, tarball)));
    },
    function setup() {
      //
      // Change directory to the target system
      //
      process.chdir(systemsDir);
    }
  )
}

vows.describe('quill/commands/systems').addBatch({
  'pack redis': shouldPackage('redis.tgz')
}).addBatch({
  'systems pack ubuntu-base': shouldPackage('ubuntu-base.tgz')
}).addBatch({
  'pack noexist': shouldQuillOk(
    'should respond with ENOENT',
    function (err, _) {
      assert.equal(err.code, 'ENOENT');
    }
  )
}).addBatch({
  'systems view test-system': shouldQuillOk(function setup() {
    nock('http://api.testquill.com')
      .get('/systems/test-system')
      .reply(200, {
        system: {
          resource: 'System',
          name: 'test-system',
          version: '0.0.0',
          description: 'Test fixtures system',
          keywords: ['test', 'fixture', 'seed-data'],
          author: 'Nodejitsu Inc. <info@nodejitsu.com>',
          dependencies: {
            'ubuntu-base': '0.1.0'
          },
          runlist: ['ubuntu-base'],
          files: ['test-config.json'],
          scripts: ['bootstrap.sh', 'image.sh']
        }
      })
  })
}).export(module);