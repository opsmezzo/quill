/*
 * quill-ssl-test.js: Tests for `quill` with client-side SSL certs.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    common = require('flatiron').common,
    vows = require('vows'),
    helpers = require('./helpers'),
    macros = require('./helpers/macros'),
    quill = require('../lib/quill');

var shouldQuillOk = macros.shouldQuillOk,
    systemsDir = path.join(__dirname, '..', 'fixtures', 'systems'),
    startDir = process.cwd(),
    ssl;
    
//
// Setup paths for SSL test fixtures
//
ssl = {
  key:  path.join(helpers.dirs.ssl, 'https-client.key'),
  cert: path.join(helpers.dirs.ssl, 'https-client.crt')
};
    
vows.describe('quill/ssl').addBatch({
  'With client-side SSL certificate and key': {
    'conf': shouldQuillOk(
      function setup() {
        quill.on('init', function () {
          quill.config.set('ssl', ssl);
        });
      },
      'should read the appropriate certs',
      function (err, _) {
        assert.isNull(err);
        assert.deepEqual(quill.config.get('ssl'), ssl);
      
        var sslFiles = Object.keys(ssl).reduce(function (all, key) {
          all[key] = fs.readFileSync(ssl[key]);
          return all;
        }, {});
      
        ['remote',
         'systems',
         'users'].forEach(function (client) {
           assert.deepEqual(quill[client].options.cert, sslFiles.cert);
           assert.deepEqual(quill[client].options.key, sslFiles.key);
        })
      }
    )
  }
}).export(module);