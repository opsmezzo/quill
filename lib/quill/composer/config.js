var async = require('flatiron').common.async,
    quill = require('../../../');

function flatten(obj, recursed) {
  var result = {};

  Object.keys(obj).forEach(function (key) {
    var r;
    if (typeof obj[key] === 'object') {
      r = flatten(obj[key], true);
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

function merge(configs, target) {
  //
  // Not the fastest algorithm ever.
  //
  target = target || {};

  configs.reverse();

  configs.forEach(function (config) {
    Object.keys(config).forEach(function (key) {
      var value = config[key];

      if (typeof value === 'object') {
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

exports.getEnv = function (system, callback) {
  var cliConfig = {},
      sets = [];

  if (!callback) {
    callback = system;
    system = null;
  }

  (quill.argv.config || []).forEach(function (config) {
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
    callback(null, flatten(merge(configs)));
  });
};
