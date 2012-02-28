/*
 * mock.js: Mock helpers for `quill`.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var mock = module.exports;

mock.systems = {};

mock.systems.get = function (api, system) {
  api.get('/systems/' + system.name)
    .reply(200, { system: system });
};