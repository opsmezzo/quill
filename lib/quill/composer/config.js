/*
 * config.js: Common utility functions for loading and rendering system configuration.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var os = require('os'),
    config = require('quill-template').config,
    errs = require('errs');

//
// Alias `.toEnvironment` from `quill-template`.
//
exports.toEnvironment = config.toEnvironment;

//
// ### function osConfig ()
// Returns a named config for system information captured
// by the node.js `os` module.
//
exports.osConfig = function () {
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

//
//
// ### function getConfig (system, callback)
// #### @system {Object} System to get configuration for
// #### @callback {function} Continuation to respond to
// Responds with the fully-merged object for all configuration
// associated with the `system`, contacting the remote composer.
//
exports.getConfig = function (system, callback) {
  var options = {
    client:  { remote: quill.remote },
    before:  [exports.osConfig()],
    remotes: quill.argv.config,
    after:   system && system.config
      ? system.config
      : null
  };

  config.getConfig(options, function (err, config) {
    if (err) {
      return callback(errs.create({
        message: [
          'Error fetching configs',
          (options.remotes || []).join(' '),
          ':',
          err.message
        ].join(' ')
      }));
    }

    callback(null, config);
  });
};

//
// ### function getEnv (system, callback)
// #### @system {Object} System to get environment for
// #### @callback {function} Continuation to respond to
// Responds with the fully-rendered env vars for all configuration
// associated with the `system`, contacting the remote composer.
//
exports.getEnv = function (system, callback) {
  exports.getConfig(system, function (err, config) {
    return err
      ? callback(err)
      : callback(null, exports.toEnvironment(config));
  });
};