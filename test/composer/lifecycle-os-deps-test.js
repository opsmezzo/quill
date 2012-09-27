var assert = require('assert'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill'),
    wtfos = require('wtfos');

wtfos.result = {
  distribution: 'ubuntu'
};

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    installDir = path.join(fixturesDir, 'installed'),
    cacheDir = path.join(fixturesDir, 'cache');

vows.describe('quill/composer/lifecycle/os-deps').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
    quill.config.set('directories:install', installDir);
  })
).addBatch({
  'When using `quill.composer`': {
    'the `run()` method': {
      topic: function () {
        quill.argv.force = true;

        var api = nock('http://api.testquill.com'),
            self = this;

        self.data = [];
        quill.on(['run', '*', 'stdout'], function (system, data) {
          self.data.push({
            name: system.name,
            data: data.toString()
          });
        });

        helpers.cleanInstalled(['ubuntu-dep']);
        mock.systems.local(api, function () {
          quill.composer.run('install', 'ubuntu-dep', self.callback);
        });
      },
      'should install the system correctly': function (err, _) {
        assert.isNull(err);
        helpers.assertScriptOutput(this.data[0], 'fixture-one');
        helpers.assertScriptOutput(this.data[1], 'ubuntu-dep');
      }
    }
  }
}).export(module);
