/*
 * quill.js: Top-level include for `quill` module.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var fs = require('fs'),
    path = require('path'),
    colors = require('colors'),
    composer = require('composer-api'),
    flatiron = require('flatiron'),
    async = flatiron.common.async;

var quill = module.exports = new flatiron.App({
  directories: {
    root:    path.join(process.env.HOME, '.quill'),
    cache:   path.join(process.env.HOME, '.quill', 'cache'),
    env:     path.join(process.env.HOME, '.quill', 'env'),
    install: path.join(process.env.HOME, '.quill', 'installed'),
    ssh:     path.join(process.env.HOME, '.ssh'),
    tmp:     path.join(process.env.HOME, '.quill', 'tmp')
  }
});

//
// Setup `jitsu` to use `pkginfo` to expose version
//
require('pkginfo')(module, 'version');

//
// Set quill.name for templating CLI output from 
// flatiron plugins like `flatiron-cli-users`
//
quill.name = 'quill';

//
// Configure quill to use `flatiron.plugins.cli`
//
quill.use(flatiron.plugins.cli, {
  usage: require('./quill/usage'),
  source: path.join(__dirname, 'quill', 'commands'),
  argv: {
    version: {
      alias: 'v',
      description: 'print quill version and exit',
      string: true
    },
    localconf: {
      description: 'search for .quillconf file in ./ and then parent directories',
      string: true
    },
    quillconf: {
      alias: 'q', 
      description: 'specify file to load configuration from',
      string: true
    },
    colors: {
      description: '--no-colors will disable output coloring',
      boolean: true,
      default: true
    },
    force: {
      alias: 'f',
      description: 'remove system before installing',
      boolean: true,
      default: false
    },
    raw: {
      description: 'quill will only output line-delimited raw JSON (useful for piping)',
      boolean: true
    }
  },
  version: true
});

//
// Set `raw` mode for quill.log if necessary
//
quill.options.log = {
  console: { raw: quill.argv.raw }
};

//
// Configure quill to use `flatiron-cli-users`.
//
quill.use(require('flatiron-cli-users'));

//
// Setup config, command aliases and prompt settings
//
quill.started           = false;
quill.common            = require('./quill/common');
quill.composer          = require('./quill/composer');
quill.prompt.override   = quill.argv;
quill.prompt.properties = flatiron.common.mixin(
  quill.prompt.properties,
  require('./quill/properties')
);
require('./quill/config');
require('./quill/alias');

//
// ### function welcome ()
// Print welcome message.
//
quill.welcome = function () {
  quill.log.info('Welcome to ' + 'quill'.grey);
  quill.log.info('It worked if it ends with ' + 'quill'.grey + ' ok'.green.bold);
};

//
// ### function start (command, callback)
// #### @command {string} Command to execute once started
// #### @callback {function} Continuation to pass control to when complete.
// Starts the quill CLI and runs the specified command.
//
quill.start = function (callback) {  
  //
  // Check for --no-colors/--colors option, without hitting the config file yet.
  //
  (typeof quill.argv.colors == 'undefined' || quill.argv.colors) || (colors.mode = "none");

  quill.init(function (err) {
    if (err) {
      quill.welcome();
      callback(err);
      return quill.showError.apply(null, [quill.argv._[0]].concat(arguments));
    }

    //
    // --no-colors option turns off output coloring, and so does setting
    // colors: false in ~/.quillconf 
    //
    quill.config.get('colors') || (colors.mode = "none");
    quill.welcome();

    var username = quill.config.get('username');
    if (!username && quill.requiresAuth.apply(quill, quill.argv._)) {
      return quill.commands.users.login(function (err) {
        if (err) {
          callback(err);
          return quill.showError.apply(quill,
            [quill.argv._[0]].concat(arguments));
        }

        var username = quill.config.get('username');
        quill.log.info('Successfully configured user ' + username.magenta);
        return quill.exec(quill.argv._, callback);
      });
    }

    return quill.exec(quill.argv._, callback);
  });
};

//
// ### function requiresAuth (resource, action)
// #### @resource {string} Resource to check auth for
// #### @action {string} Resource action to check auth for
// 
// Returns a value indicating if the specified `resource action` pair
// requires user authentication.
//
quill.requiresAuth = function (resource, action) {
  var requiresAuth = quill.config.get('requiresAuth')[resource];
  
  if (requiresAuth === true) {
    return true;
  }
  else if (Array.isArray(requiresAuth)) {
    return requiresAuth.indexOf(action) !== -1;
  }
  
  return false;
};

//
// ### function exec (command, callback)
// #### @command {string} Command to execute
// #### @callback {function} Continuation to pass control to when complete.
// Runs the specified command in the quill CLI.
//
quill.exec = function (command, callback) {
  function execCommand (err) {
    if (err) {
      return callback(err);
    }

    quill.log.info('Executing command ' + command.join(' ').magenta);
    quill.router.dispatch('on', command.join(' '), quill.log, function (err, shallow, skip) {
      if (err) {
        callback(err);
        return quill.showError(command.join(' '), err, shallow, skip);
      }

      //
      // TODO (indexzero): Something here
      //
      callback.apply(null, arguments);
    });
  }

  return !quill.started ? quill.setup(execCommand) : execCommand();
};

//
// ### function setup (callback)
// #### @callback {function} Continuation to pass control to when complete.
// Sets up the instances of the Resource clients for quill.
// there is no io here, yet this function is ASYNC.
//
quill.setup = function (callback) { 
  if (quill.started === true) {
    return callback();
  }

  var key  = quill.config.get('ssl:key'),
      cert = quill.config.get('ssl:cert');

  //
  // Actually setup potentially after loading
  // cert and key files async
  //
  function setupClient(err, ssl) {
    if (err) {
      quill.warn('Error reading SSL certificates:')
      quill.warn(key);
      quill.warn(cert);
    }

    var client = composer.createClient({
      host:  quill.config.get('remoteHost'),
      port:  quill.config.get('port'),
      proxy: quill.config.get('proxy'),
      cert:  ssl && ssl.cert,
      key:   ssl && ssl.key,
      auth: {
        get username() { return quill.config.get('username'); },
        get password() { return quill.config.get('password'); }
      }
    });

    Object.keys(client).forEach(function (key) {
      if (key === 'config') {
        quill.remote = client[key];
        return;
      }

      quill[key] = client[key];
    });

    quill.started = true;
    callback();
  }
  
  if (key && cert) {
    return async.parallel({
      cert: async.apply(fs.readFile, cert),
      key: async.apply(fs.readFile, key),
    }, setupClient)
  }
  
  setupClient();
};

//
// ### function showError (command, err, shallow, skip)
// #### @command {string} Command which has errored.
// #### @err {Error} Error received for the command.
// #### @shallow {boolean} Value indicating if a deep stack should be displayed
// #### @skip {boolean} Value indicating if this error should be forcibly suppressed.
// Displays the `err` to the user for the `command` supplied.
//
quill.showError = function (command, err, shallow, skip) {
  var username,
      stack,
      lines;

  if (err.statusCode === '403') {
    username = quill.config.get('username');
    if (username) {
      quill.log.error('Unable to authenticate as: ' + username.magenta);
    }
    
    quill.log.error('403 ' + err.result.error);    
  }
  else if (!skip) {
    quill.log.error('Error running command ' + command.magenta);
    
    if (err.message) {
      quill.log.error(err.message);
    }

    if (err.result) {
      if (err.result.error) {
        quill.log.error(err.result.error);
      }

      if (err.result.stack) {
        lines = err.result.stack.split('\n');
        quill.log.error(lines[0].replace(/Error\s?:?\s?/, ''));

        if (!shallow) {
          quill.log.warn('Error returned from Conservatory');
          lines.slice(1).forEach(function (line) {
            quill.log.error(line);
          });
        }
      }
    }
    else {
      if (err.stack && !shallow) {
        err.stack.split('\n').forEach(function (trace) {
          quill.log.error(trace);
        });
      }
    }
  }

  quill.log.info('quill '.grey + 'not ok'.red.bold);
};
