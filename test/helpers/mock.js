/*
 * mock.js: Mock helpers for `quill`.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    common = require('flatiron').common,
    async = common.async,
    nock = require('nock'),
    composer = require('../../lib/quill/composer'),
    systems = require('../fixtures/systems');

var mock = module.exports;

var systemsDir = path.join(__dirname, '..', 'fixtures', 'systems'),
    sourceDir = path.join(systemsDir, 'tgz');

mock.api     = nock('http://api.testquill.com');
mock.systems = {};

mock.systems.get = function (api, system) {
  for (var i = 5; i > 0; i--) {
    //
    // Remark: This is bad. Should have an option which always returns this thing.
    //
    api.get('/systems/' + system.name)
      .reply(200, { system: system });
  }
};

mock.systems.download = function (api, system, tarball) {
  api.get('/systems/' + system.name + '/' + system.version)
    .reply(200, fs.readFileSync(tarball));
};

mock.systems.all = function (api) {
  systems.forEach(function (system) {
    mock.systems.get(api, system);
  });
};

//
// ### function local (api, versions, callback)
// Mocks the `api` for all of the systems in `/test/fixtures/systems/*`.
//
mock.systems.local = function (api, versions, callback) {
  if (!callback && typeof versions === 'function') {
    callback = versions;
    versions = null;
  }

  //
  // Helper function to list a dir, read the system.json
  // and mock the system if appropriate.
  //
  function mockLocal(dir, next) {
    fs.readdir(dir, function (err, files) {
      if (err) {
        return next(err);
      }
      else if (files.indexOf('system.json') === -1) {
        return next();
      }
      
      composer.readJson(dir, function (err, system) {
        if (err) {
          return next(err);
        }

        var copy = common.clone(system);

        system.versions = {};
        versions = versions
          ? versions.concat(system.version)
          : [system.version];

        versions.forEach(function addVersion(version) {
          var ver = common.clone(copy)
          ver.version = version;
          system.versions[version] = ver;
        });
        mock.systems.get(api, system);
        mock.systems.download(api, system, path.join(sourceDir, system.name + '.tgz'));
        next();
      });
    });
  }
  
  //
  // Helper function read a given system
  //
  function checkSystem(dir, next) {
    fs.stat(dir, function (err, stat) {
      if (err) {
        return callback(err);
      }
      
      return stat.isDirectory()
        ? mockLocal(dir, next)
        : next();
    })
  }
  
  fs.readdir(systemsDir, function (err, systems) {
    if (err) {
      return callback(err);
    }
    
    async.forEach(systems.map(function (dir) { 
      return path.join(systemsDir, dir);
    }), checkSystem, callback);
  });
};