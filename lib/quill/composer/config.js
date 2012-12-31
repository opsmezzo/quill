/*
 * config.js: Common utility functions for loading and rendering system configuration.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var async = require('flatiron').common.async,
    quill = require('../../../');

//
// ### @private function fetch (configs, callback)
// Fetches all of the `configs` names from the remote
// composer.
//
function fetch(configs, callback) {
  async.map(configs, quill.remote.get.bind(quill.remote), function (err, data) {
    if (err) {
      return callback(err);
    }

    callback(null, data.map(function (d) {
      return d.settings;
    }));
  });
}

//
// ### @private function merge (configs, target)
// Merges all of the `configs` objects onto the
// specified `target`.
//
function merge(configs, target) {
  //
  // Not the fastest algorithm ever.
  //
  target = target || {};
  configs.reverse();

  configs.forEach(function (config) {
    Object.keys(config).forEach(function (key) {
      var value = config[key];

      if (typeof value === 'object' && !Array.isArray(value)) {
        target[key] = {};
        merge(configs.map(function (config) {
          return config[key];
        }).filter(Boolean).reverse(), target[key]);
      }
      else {
        target[key] = value;
      }
    });
  });

  return target;
}

//
//
// ### function getConfig (system, callback)
// #### @system {Object} System to get configuration for
// #### @callback {function} Continuation to respond to
// Responds with the fully-merged object for all configuration
// associated with the `system`, contacting the remote composer.
//
exports.getConfig = function (system, callback) {
  var argv = quill.argv.config,
      cliConfig = {},
      sets = [];

  if (!callback) {
    callback = system;
    system = null;
  }

  argv = argv
    ? (Array.isArray(argv)) ? argv : [argv]
    : [];

  argv.forEach(function (config) {
    var equals = config.indexOf('=');

    if (equals !== -1) {
      cliConfig[config.substr(0, equals)] = config.substr(equals + 1);
      return;
    }

    sets.push(config);
  });

  fetch(sets, function (err, configs) {
    if (err) {
      return callback(null);
    }

    configs.unshift(cliConfig);
    if (system && system.config) {
      configs.push(system.config);
    }
    callback(null, merge(configs));
  });
};

//
// ### function toEnvironment (obj, recursed)
// #### @obj {Object} Configuration object to convert to env vars.
// #### @recursed {Boolean} Value indicating if we should add `quill_` to the result.
// Returns an environment representation of the specified `obj`. e.g.
//
//    {
//      "foo": 1
//    }
//
// returns
//
//    {
//      "quill_foo": 1
//    }
//
exports.toEnvironment = function (obj, recursed) {
  var result = {};

  Object.keys(obj).forEach(function (key) {
    var r;
    if (typeof obj[key] === 'object') {
      r = exports.toEnvironment(obj[key], true);
      Object.keys(r).forEach(function (rKey) {
        result[key + '_' + rKey] = r[rKey];
      });
    }
    else {
      result[key] = obj[key];
    }
  });

  if (!recursed) {
    Object.keys(result).forEach(function (key) {
      result['quill_' + key] = result[key];
      delete result[key];
    });
  }

  return result;
}

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
