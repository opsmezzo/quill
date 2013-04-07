/*
 * config.js: Common utility functions for loading and rendering system configuration.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    os = require('os'),
    path = require('path'),
    async = require('flatiron').common.async,
    template = require('quill-template'),
    config = template.config,
    errs = require('errs'),
    quill = require('../../quill');

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

  return config.getConfig(options, function (err, config) {
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
  return exports.getConfig(system, function (err, config) {
    return err
      ? callback(err)
      : callback(null, exports.toEnvironment(config));
  });
};

//
// ### function extract (system, dir, callback)
// Extracts all of the keys for the system in the specified
// dir and sets it to `system.vars`.
//
exports.extract = function (system, dir, callback) {
  var dirs = {
    templates: path.join(dir, 'templates'),
    scripts:   path.join(dir, 'scripts'),
    files:     path.join(dir, 'files')
  };

  async.parallel({
    templates: async.apply(template.extract.keys.list, dirs.templates),
    envvars: function (next) {
      var executable = /[7|5|1]/;

      //
      // Only attempt to extract envvars from files which
      // are executable.
      //
      fs.readdir(dirs.files, function (err, files) {
        if (err) {
          return err.code === 'ENOENT'
            ? next(null, [])
            : next(err);
        }

        files = files.map(function (file) {
          return path.join(dirs.files, file);
        });

        async.map(files, fs.stat, function (err, stats) {
          if (err) { return next(err) }

          files = files.filter(function (_, i) {
            var mode = (stats[i].mode & parseInt('777', 8)).toString(8);
            return executable.test(mode);
          });

          template.extract.envvars.list(files.concat(dirs.scripts), next);
        });
      });
    }
  }, function (err, result) {
    var vars = { required: [], optional: [] };

    if (result.envvars && result.envvars.required
      && result.envvars.required.length) {
      vars.required = result.envvars.required.slice();
    }

    if (result.templates) {
      if (result.templates.required && result.templates.required.length) {
        vars.required = vars.required.concat(
          result.templates.required.filter(function (key) {
            return !~vars.required.indexOf(key)
          })
        );
      }

      if (result.templates.optional && result.templates.optional.length) {
        vars.optional = vars.optional.concat(result.templates.optional);
      }
    }

    callback(null, vars);
  });
};