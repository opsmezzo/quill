/*
 * installed.js: Commands related to working with installed systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    archy = require('archy'),
    fstream = require('fstream'),
    semver = require('semver'),
    quill = require('../../quill'),
    async = require('flatiron').common.async,
    composer = quill.composer;

var installed = exports;

installed.usage = [
  '`quill installed *` commands allow you view information about',
  'installed systems on target machines',
  '',
  'quill installed list',
  'quill installed latest <system>'
];

//
// ### function list (callback)
// #### @callback {function} Continuation to respond to.
// Lists all systems installed on the current machine.
//
installed.list = function (callback) {
  composer.installed.list(function (err, list) {
    if (err) {
      return callback(err);
    }
    else if (!list) {
      quill.log.warn('No systems installed');
      return callback();
    }

    var names = Object.keys(list);

    if (!names || !names.length) {
      quill.log.warn('No systems installed');
    }
    else {
      archy(composer.hierarchy(
        quill.config.get('directories:install'),
        names.reduce(function (systems, name) {
          systems[name] = list[name].system;
          return systems;
        }, {})
      ))
      .split('\n')
      .filter(Boolean)
      .forEach(function (line) {
        quill.log.data(line);
      });
    }

    callback();
  });
};

//
// Usage for `quill systems installed`.
//
installed.list.usage = [
  'Lists all systems installed on the current machine.',
  '',
  'quill installed list',
  'quill installed'
];

installed.latest = function (name, callback) {
  quill.log.info('Latest versions that satisfy all semver requirements.');
  composer.dependencies.maxSatisfying({
    client: quill.systems,
    system: name
  }, function (err, latest) {
    if (err) {
      return callback(err);
    }

    quill.inspect.putObject(latest);
    callback(null, latest);
  });
}