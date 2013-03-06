/*
 * config.js: Configuration for the quill CLI.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var path = require('path'),
    fs = require('fs'),
    quill = require('../quill');

//
// Store the original `quill.config.load()` function
// for later use.
//
var _load = quill.config.load;

//
// Setup target file for `.quillconf`.
//
//
// TODO: Refactor broadway to emit `bootstrap:after` and put this 
//       code in a handler for that event
//
try {
  quill.config.file({
    file: quill.argv.quillconf || quill.argv.q || '.quillconf',
    dir: process.env.HOME,
    search: true
  });
}
catch (err) {
  console.log('Error parsing ' + quill.config.stores.file.file.magenta);
  console.log(err.message);
  console.log('');
  console.log('This is most likely not an error in quill.');
  console.log('Please check your quillconf and try again.');
  console.log('');
  process.exit(1);
}


var defaults = {
  authorizedKeys: 'authorized_keys',
  colors: true,
  debug: true,
  gzipbin: 'gzip',
  loglevel: 'info',
  loglength: 110,
  protocol: 'http',
  remoteHost: 'localhost',
  port: 9003,
  progress: false,
  raw: false,
  requiresAuth: {
    systems: true
  },
  root: process.env.HOME,
  tar: 'tar',
  tmproot: process.env.HOME + '/.quill/tmp',
  userconfig: '.quillconf',
  modes: {
    exec: 0777 & (~022), 
    file: 0666 & (~022),
    umask: 022
  },
  watch: {
    interval: 60 * 5 * 1000
  }
};


Object.defineProperty(defaults, 'remoteUri', {
  get: function () {
    var port = quill.config.get('port') || '';
    if (port) {
      port = ':' + port;
    }

    return [this.protocol, '://', quill.config.get('remoteHost'), port].join('');
  }
});

//
// Set defaults for `quill.config`.
//
quill.config.defaults(defaults);

//
// Use the `cli-config` plugin for `quill config *` commands
//
quill.use(require('flatiron-cli-config'), {
  store: 'file',
  restricted: [
    'auth', 
    'gzipbin',
    'root', 
    'remoteUri', 
    'tmproot', 
    'tar', 
    'userconfig'
  ],
  before: {
    list: function () {
      var username = quill.config.get('username'),
          configFile = quill.config.stores.file.file;

      var display = [
        ' here is your ' + configFile.grey + ' file:',
        'If you\'d like to change a property try:',
        'quill config set <key> <value>',
      ];

      if (!username) {
        quill.log.warn('No user has been setup on this machine');
        display[0] = 'Hello' + display[0];
      }
      else {
        display[0] = 'Hello ' + username.green + display[0];
      }

      display.forEach(function (line) {
        quill.log.help(line);
      });

      return true;
    }
  }
});

//
// Override `quill.config.load` so that we can map
// some existing properties to their correct location.
//
quill.config.load = function (callback) {
  _load.call(quill.config, function (err, store) {
    if (err) {
      return callback(err, true, true, true);
    }

    quill.config.set('userconfig', quill.config.stores.file.file);
    
    if (store.auth) {
      var auth = store.auth.split(':');
      quill.config.clear('auth');
      quill.config.set('username', auth[0]);
      quill.config.set('password', auth[1]);
      return quill.config.save(callback);
    }

    callback(null, store);
  });
};