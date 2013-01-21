var assert = require('assert'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    installDir = path.join(fixturesDir, 'installed'),
    cacheDir = path.join(fixturesDir, 'cache');

vows.describe('quill/composer/lifecycle/order').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
    quill.config.set('directories:install', installDir);
  })
).addBatch({
  'When using `quill.composer`': {
    'the `run()` method with `start` script': {
      topic: function () {
        quill.argv.force = true;

        var api = nock('http://api.testquill.com'),
            self = this;

        self.data = '';
        quill.on(['run', 'stdout'], function (system, data) {
          self.data += data.toString();
        });

        helpers.cleanInstalled(['order']);
        mock.systems.local(api, function () {
          quill.composer.run('start', 'order', self.callback);
        });
      },
      'should install the system correctly': function (err, _) {
        assert.isNull(err);
        assert.equal(this.data, [
          'Installing order',
          'Configuring order',
          'Starting order'
        ].join('\n') + '\n');
      }
    }
  }
}).addBatch({
  'When using `quill.composer`': {
    'the `run()` method with `configure` script': {
      topic: function () {
        quill.argv.force = true;

        var api = nock('http://api.testquill.com'),
            self = this;

        self.data = '';
        quill.on(['run', 'stdout'], function (system, data) {
          self.data += data.toString();
        });

        helpers.cleanInstalled(['order']);
        mock.systems.local(api, function () {
          quill.composer.run('configure', 'order', self.callback);
        });
      },
      'should install the system correctly': function (err, _) {
        assert.isNull(err);

        assert.equal(this.data, [
          'Installing order',
          'Configuring order'
        ].join('\n') + '\n');
      }
    }
  }
}).export(module);
