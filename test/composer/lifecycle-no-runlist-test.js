var path = require('path'),
    assert = require('assert'),
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    installDir = path.join(fixturesDir, 'installed'),
    cacheDir = path.join(fixturesDir, 'cache');

vows.describe('quill/composer/lifecycle/no-runlist').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
    quill.config.set('directories:install', installDir);
  })
).addBatch({
  "When using quill.composer": {
    "the run() method": {
      topic: function () {
        var api = nock('http://api.testquill.com'),
        that = this;

        that.data = [];
        quill.on(['run', '*', 'stdout'], function (system, data) {
          that.data.push({
            name: system.name, 
            data: '' + data
          });
        });

        helpers.cleanInstalled();
        mock.systems.local(api, function () {
          quill.composer.run('install', 'no-runlist', that.callback);
        });
      },
      "should run the specified scripts": function (err, systems) {
        assert.isNull(err);

        helpers.assertScriptOutput(this.data[0], 'fixture-one');
        helpers.assertScriptOutput(this.data[1], 'fixture-two');
        helpers.assertScriptOutput(this.data[2], 'no-runlist');
      }
    }
  }
}).export(module);
