/*
 * systems-test.js: Tests for `quill systems *` commands.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    os = require('os'),
    common = require('flatiron').common,
    async = common.async,
    rimraf = common.rimraf,
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var shouldQuillOk = macros.shouldQuillOk,
    systemsDir    = helpers.dirs.systems,
    startDir      = process.cwd();

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
      assert.ok(fs.existsSync(path.join(systemsDir, tarball)));
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

//
// Macro for asserting that a system is bumped
//
function shouldBump(expectedVersion, system) {
  return shouldQuillOk(
    'should update the version',
    function setup() {
      system = system || this.args[2];
      var systemDir = path.join(systemsDir, system),
          targetDir = this.args[2]
            ? systemsDir
            : systemDir

      //
      // Change directory to the target system
      //
      process.chdir(targetDir);
      this.jsonFile     = path.join(systemDir, 'system.json');
      this.originalText = fs.readFileSync(this.jsonFile, 'utf8');
      this.systemJson   = JSON.parse(this.originalText);
    },
    function (err, _) {
      var newJson = JSON.parse(fs.readFileSync(this.jsonFile, 'utf8'));
      assert.notEqual(this.systemJson.version, newJson.version);
      assert.equal(expectedVersion, newJson.version);

      //
      // Change back to the starting directory and write
      // the original systemJson back to disk
      //
      process.chdir(startDir);
      fs.writeFileSync(
        this.jsonFile,
        this.originalText,
        'utf8'
      );
    }
  );
}

vows.describe('quill/commands/systems').addBatch({
  'pack fixture-one': shouldPackage('fixture-one-0.0.0.tgz')
}).addBatch({
  'systems pack fixture-two': shouldPackage('fixture-two-0.0.0.tgz')
}).addBatch({
  'bump': shouldBump('0.0.1', 'hello-world')
}).addBatch({
  'bump minor hello-world': shouldBump('0.1.0')
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
  'install hello-world': shouldQuillOk(
    function setup(callback) {
      var installFile = path.join(systemsDir, 'hello-world', 'scripts', 'install.sh'),
          api = nock('http://api.testquill.com'),
          that = this;

      //
      // Change the install file so that it is not executable
      //
      fs.chmodSync(installFile, '750');

      that.data = [];
      quill.on(['run', 'stdout'], function (system, data) {
        that.data.push({
          name: system.name,
          data: '' + data
        });
      });

      mock.systems.local(api, callback);
      helpers.cleanInstalled(['fixture-one', 'hello-world']);
    },
    'should run the specified script',
    function (err, _) {
      assert.isNull(err);
      assertScriptOutput(this.data[0], 'fixture-one');
      assertScriptOutput(this.data[1], 'hello-world');
    }
  )
}).addBatch({
  'When a newer version is available': {
    'update hello-world': shouldQuillOk(
      function setup(callback) {
        var systemDir = path.join(systemsDir, 'hello-world'),
            installFile = path.join(systemDir, 'scripts', 'install.sh'),
            api = nock('http://api.testquill.com'),
            that = this;

        that.data = [];
        quill.on(['run', 'stdout'], function (system, data) {
          that.data.push({
            name: system.name,
            data: '' + data
          });
        });

        mock.systems.local(api, {
          'hello-world': {
            requests: 2,
            versions: ['0.1.0'],
            latest: '0.1.0'
          }
        }, callback);
      },
      'should install the latest version',
      function (err, _) {
        assert.isNull(err);
        assert.lengthOf(this.data, 1);
        assert.equal(this.data[0].name, 'hello-world');
        assert.equal(this.data[0].data, '0.1.0\n');
      }
    )
  }
}).addBatch({
  'when lifecycle:disabled is the current platform': {
    'install fixture-one': shouldQuillOk(
      function setup(callback) {
        var api = nock('http://api.testquill.com'),
            that = this;

        that.data = [];
        quill.on(['run', 'stdout'], function (system, data) {
          that.data.push({
            name: system.name,
            data: '' + data
          });
        });

        //
        // Mock `os.platform` so this test passes on every
        // platform.
        //
        quill.config.set('lifecycle:disabled', 'quill-test');
        os.__platform = os.platform;
        os.platform = function () {
          return 'quill-test';
        };

        mock.systems.local(api, callback);
        helpers.cleanInstalled(['fixture-one']);
      },
      'should move files into place but not run the specified script',
      function (err, _) {
        assert.isNull(err);
        assert.lengthOf(this.data, 0);
        assert.isArray(fs.readdirSync(path.join(helpers.dirs.install, 'fixture-one')))

        //
        // Revert platform mocking.
        //
        os.platform = os.__platform;
        delete os.__platform;
      }
    )
  }
}).addBatch({
  'With valid remoteDependencies': {
    'install hello-remote-deps': shouldQuillOk(
      function setup(callback) {
        var api = nock('http://api.testquill.com'),
            that = this;

        that.data = [];
        quill.on(['run', 'stdout'], function (system, data) {
          that.data.push({
            name: system.name,
            data: '' + data
          });
        });

        helpers.cleanInstalled(['fixture-two', 'hello-remote-deps']);
        mock.config.servers(api, ['fixture-one']);
        mock.systems.local(api, callback);
      },
      'should install the latest version',
      function (err, _) {
        assert.isNull(err);
        assert.lengthOf(this.data, 2);
        assert.equal(this.data[1].name, 'hello-remote-deps');
      }
    )
  }
}).addBatch({
  'unpublish fixture-one': shouldQuillOk(
    function setup() {
      nock('http://api.testquill.com')
        .delete('/systems/fixture-one')
        .reply(200);
    }
  )
}).export(module);
