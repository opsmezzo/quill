/*
 * config.js: Common utility functions for loading and rendering system configuration.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var os = require('os');

var config = module.exports = require('quill-template').config;

//
// ### function osConfig ()
// Returns a named config for system information captured
// by the node.js `os` module.
//
config.osConfig = function () {
  var interfaces = os.networkInterfaces();

  return {
    os: {
      hostname: os.hostname(),
      type: os.type(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length,
      networkInterfaces: Object.keys(interfaces).reduce(function (all, name) {
        all[name] = interfaces[name].reduce(function (families, info) {
          var family = info.family.toLowerCase();

          families[family] = families[family] || [];
          families[family].push(info.address);
          return families;
        }, {});

        return all;
      }, {})
    }
  }
};