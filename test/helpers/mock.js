/*
 * mock.js: Mock helpers for `quill`.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var nock = require('nock'),
    systems = require('../fixtures/systems');

var mock = module.exports;

mock.api     = nock('http://api.testquill.com');
mock.systems = {};

mock.systems.get = function (api, system) {
  api.get('/systems/' + system.name)
    .reply(200, { system: system });
};

mock.systems.all = function (api) {
  systems.forEach(function (system) {
    mock.systems.get(api, system);
  });
};

