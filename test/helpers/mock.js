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
    helpers = require('./index');
    systems = require('system.json/test/fixtures');

var mock = module.exports = require('system.json/test/helpers/mock');

var systemsDir = helpers.dirs.systemsDir,
    sourceDir  = path.join(systemsDir, 'tgz');

mock.config = {};
mock.config.servers = function (api, systems) {
  api.get('/config/servers')
    .reply(200, systems.reduce(function (config, name) {
      config[name] = [{
        'public':  ['127.0.0.1'],
        'private': ['127.0.0.1']
      }];

      return config;
    }, {}));
};

mock.systems.download = function (api, system, tarball) {
  var defaultTarball = path.join(sourceDir, system.name + '.tgz')

  Object.keys(system.versions).forEach(function (version) {
    var tarball = path.join(sourceDir, system.name + '-' + version + '.tgz'),
        contents = fs.existsSync(tarball)
          ? fs.readFileSync(tarball)
          : fs.readFileSync(defaultTarball);

    api.get('/systems/' + system.name + '/' + version)
      .reply(200, contents);
  });
};

//
// ### function local (api, systems, callback)
// Mocks the `api` for all of the systems in `/test/fixtures/systems/*`.
//
mock.systems.local = function (api, systems, callback) {
  if (!callback && typeof systems === 'function') {
    callback = systems;
    systems = null;
  }

  systems = systems || {};

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

        var copy = common.clone(system),
            versions;

        system.versions      = {};
        systems[system.name] = systems[system.name] || {};
        versions             = systems[system.name].versions
            ? systems[system.name].versions.concat(system.version)
            : [system.version];

        versions.forEach(function addVersion(version) {
          var ver = common.clone(copy)
          ver.version = version;
          system.versions[version] = ver;
        });

        systems[system.name].requests = systems[system.name].requests || 1;
        for (var i = 0; i < systems[system.name].requests; i++) {
          mock.systems.get(api, system);
          mock.systems.download(api, system);

          //
          // Only update to latest after the first request.
          //
          if (systems[system.name].latest) {
            system.version = systems[system.name].latest;
          }
        }

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