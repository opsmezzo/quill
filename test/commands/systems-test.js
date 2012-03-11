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
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var shouldQuillOk = macros.shouldQuillOk,
    systemsDir = path.join(__dirname, '..', 'fixtures', 'systems'),
    startDir = process.cwd();

//
// Remove any existing tarballs for idempotency.
//
fs.readdirSync(systemsDir).filter(function (file) {
  return path.extname(file) === '.tgz';
}).forEach(function (tarball) {
  try { fs.unlinkSync(path.join(systemsDir, tarball)); }
  catch (err) { }
});

function assertScriptOutput(actual, expected) {
  assert.isObject(actual);
  assert.equal(actual.name, expected);
  assert.equal(actual.data, fs.readFileSync(
    path.join(systemsDir, expected, 'files', expected + '.txt'),
    'utf8'
  ));
}

//
// Helper function which asserts that the context creates
// the target `tarball`.
//
function shouldPackage(tarball) {
  return shouldQuillOk(
    'should create the specified tarball',
    function (_, err) {
      assert.ok(path.existsSync(path.join(systemsDir, tarball)));
      //
      // Change back to the starting directory
      //
      process.chdir(startDir);
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
  'pack fixture-one': shouldPackage('fixture-one.tgz')
}).addBatch({
  'systems pack fixture-two': shouldPackage('fixture-two.tgz')
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
          scripts: ['install.sh', 'configure.sh']
        }
      })
  })
}).addBatch({
  'With an invalid lifecycle action': {
    'systems lifecycle foobar': shouldQuillOk(
      'should respond with an error',
      function (err, _) {
        assert.match(err.message, /Invalid action/);
      }
    )
  }
}).addBatch({
  'install fixture-one': shouldQuillOk(
    function setup(callback) {
      var api = nock('http://api.testquill.com'),
          that = this;

      that.data = [];
      quill.on(['run', '*', 'stdout'], function (system, data) {
        that.data.push({
          name: system.name, 
          data: '' + data
        });
      });
    
      mock.systems.local(api, callback);
    },
    'should run the specified script',
    function (err, _) {
      assert.isNull(err);
      assertScriptOutput(this.data[0], 'fixture-one');
    }
  )
}).export(module);