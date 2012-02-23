/*
 * systems.js: Commands related to working with system configuration
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    quill = require('../../quill'),
    system = quill.common.system;

var systems = exports;

systems.usage = [
  '`quill systems *` commands allow you to install, update',
  'and configure systems on target machines',
  '',
  'quill install <system>',
  'quill publish <dir>',
  'quill package <dir>',
  '',
  'quill systems list',
  'quill systems install <system>',
  'quill systems publish <dir>',
  'quill systems package <dir>',
  'quill systems view <system>'
];

systems.package = function (dir, callback) {
  dir = dir || process.cwd();
  dir = path.resolve(dir);
  
  system.package(dir, callback).on('read', function () {
    quill.log.info('Reading system.json in ' + dir.yellow);
  }).on('list', function (pkg) {
    quill.log.info('Listing system files for package:');
    quill.inspect.putObject(pkg);
  }).on('pack', function (target) {
    quill.log.info('Packaging system into ' + target.yellow);
  });
};