/*
 * keys.js: Commands related to working with SSH keys
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    utile = require('utile'),
    async = utile.async,
    rimraf = utile.rimraf,
    quill = require('../../quill'),
    conservatory = require('conservatory');
    
var keys = exports, rackspace;

keys.usage = [
  '`quill keys *` commands allow you to work with SSH',
  'keys required for managing servers from your machine',
  '',
  'quill keys create',
  'quill keys list',
  'quill keys list <pattern>',
  'quill keys gethost'
];

//
// ### @private function createRackspace
// Creates an instance of the `quill` Rackspace
// boostrapper for use later on.
//
function createRackspace () {
  if (!rackspace) {
    rackspace = new conservatory.bootstrap.Rackspace({
      env: quill.config.get('env'),
      cache: {
        cachePath: quill.config.get('directories:keys')
      }
    });
  }
  
  return rackspace;
}

//
// ### @private function checkKeyhost (callback)
// #### @callback {function} Continuation to respond to when complete.
// Creates a temporary ssh-key and parses the public key to discover
// the host of the current machine.
//
function checkKeyhost (callback) {
  var tmproot  = quill.config.get('tmproot'),
      tmpkey   = path.join(tmproot, 'tmpkey'),
      keysDir  = quill.config.get('directories:keys'),
      commands = [],
      keyfiles = [];
  
  //
  // #### function extractKeyhost (keys, done)
  // Extracts the host from the SSH public key that we have created.
  //
  function extractKeyhost (keys, done) {
    quill.log.silly('Reading: ' + keys.public);
    conservatory.common.keys.extractHost(keys.public, function (err, name) {
      if (err) {
        return callback(err);
      }
      
      //
      // Append commands and keyfiles for the `public` and `private` keys
      //
      [name + '.pub', name].forEach(function (file) {
        var key = path.extname(file) === '.pub' ? 'public' : 'private',
            fullpath = path.join(keysDir, file);
            
        commands.push(['mv', keys[key], fullpath]);
        keyfiles.push(fullpath);
      });
      
      quill.log.info('Setting keyhost: ' + name.magenta);
      quill.config.set('keyhost', name);
      quill.config.save(function () {
        return done(null, name);
      })
    });
  }
  
  //
  // Remove any existing temporary keys, generate a new key, then parse
  // out the host and respond appropriately.
  //
  rimraf(tmpkey, function () {
    quill.log.info('Creating key: ' + tmpkey.magenta);
    conservatory.common.keys.keygen(tmpkey, function (err, private, public) {
      var keys = {
        public: public,
        private: private
      };
      
      extractKeyhost(keys, function (err, name) {
        callback(null, {
          keyhost: name,
          keyfiles: keyfiles,
          commands: commands,
          tmpkeys: [
            tmpkey,
            tmpkey + '.pub'
          ]
        });
      });
    });
  });
};

//
// ### function create (settings, callback)
// #### @settings {Object} Existing settings to use when creating
// #### @callback {function} Continuation to respond to when complete.
// Creates an SSH key for this machine based on the following control flow:
// 
// 1. Determine the host for this machine
// 2. Check for existing remote keys for this host (if any).
// 3. If there are no existing keys, upload them.
// 4. Otherwise if there are existing keys, download them (if necessary).
//
keys.create = function (settings, callback) {
  if (!callback) {
    callback = settings;
    settings = null;
  }
  
  var env           = quill.config.get('env'),
      keysDir       = quill.config.get('directories:keys'),
      keysContainer = quill.config.get('rackspace:keysContainer'),
      rackspace     = createRackspace();
  
  //
  // #### function spawnProc (command, next)
  // Spawns the specified `command` and streams the results
  // to the command line using `winston`.
  //
  function spawnProc (command, next) {
    quill.log.info('Executing: ' + command.join(' '));
    var child = spawn(command[0], command.slice(1));
    
    child.stdout.on('data', function (data) {
      quill.log.data(data.toString());
    });
    
    child.stderr.on('data', function (data) {
      quill.log.error(data.toString());
    })
    
    child.on('exit', function () {
      next();
    });
  }

  //
  // #### function cleanupTmp ()
  // Cleans up the temporary keys created during the key creation process.
  //
  function cleanupTmp () {
    quill.log.info('Your keys are now in: ' + keysDir.magenta);
    async.forEach([path.join(keysDir, 'ssh-keys')].concat(settings.tmpkeys), rimraf, function () {
      exec('chmod 0600 ' + keysDir + '/*', function () {
        callback();
      });
    });
  }

  //
  // #### function uploadKeys (localKeys)
  // Uploads the local keys created to Rackspace for future use. 
  //
  function uploadKeys (localKeys) {
    var keyinfo = {},
        rackspace = createRackspace();
    
    localKeys.forEach(function (file) {
      var key = path.extname(file) === '.pub' ? 'public' : 'private';
      
      keyinfo[key] = {
        name: path.basename(file),
        path: file
      };
    });
    
    quill.log.info('Uploading local keys to Rackspace: ' + env.magenta);
    quill.inspect.putObject(keyinfo);
    rackspace.uploadKeys(keyinfo, cleanupTmp);
  }
  
  //
  // #### function downloadKeyfile (keyfile)
  // Downloads the specified keyfile into `quill.config.get('directories:keys')`.
  //
  function downloadKeyFile (keyfile, next) {
    rackspace.cloudfiles.getFile(keysContainer, path.basename(keyfile), next);
  }

  //
  // #### function downloadKeys ()
  // Downloads all remote keyfiles into `quill.config.get('directories:keys')`.
  //
  function downloadKeys () {
    rackspace.cloudfiles.setAuth(function () {
      async.forEach(settings.keyfiles, downloadKeyFile, function () {
        var cachePath = path.join(keysDir, 'ssh-keys', '*');
        exec('mv ' + cachePath + ' ' + keysDir, cleanupTmp);
      });
    });
  }

  //
  // #### function moveKeys (localKeys)
  // Moves the temporary keys info `quill.config.get('directories:keys')`
  //
  function moveKeys (localKeys) {
    quill.log.info('Creating SSH keypair: ' + settings.keyhost.magenta);
    async.forEach(settings.commands, spawnProc, function () {
      uploadKeys(settings.commands.map(function (command) {
        return command.slice(-1);
      }));
    });
  }
  
  //
  // #### function checkLocalKeys (hasRemote)
  // Checks for the existance of any local keys for the target keyhost
  //
  function checkLocalKeys (hasRemote) {
    quill.log.info('Checking for existing local keys: ' + keysDir.magenta);
    fs.readdir(keysDir, function (err, existing) {
      if (err) {
        return callback(err);
      }
      
      existing = existing.filter(function (e) { return ~e.indexOf(settings.keyhost) });
      if (existing.length === 0) {
        quill.log.warn('No local keys for: ' + settings.keyhost.magenta);
        return hasRemote ? downloadKeys() : moveKeys(existing);
      }
      
      quill.log.info('Local keys found for: ' + settings.keyhost.magenta);
      return hasRemote ? cleanupTmp() : uploadKeys(existing.map(function (key) {
        return path.join(keysDir, key);
      }));
    });
  }
  
  //
  // #### function checkRemoteKeys (hasRemote)
  // Checks for the existance of any remote keys for the target keyhost.
  //
  function checkRemoteKeys () {
    quill.log.info('Checking for existing remote key: ' + settings.keyhost.magenta);
    keys.list(settings.keyhost, function (err, files) {
      if (err) {
        return callback(err);
      }
      else if (files.length === 0) {
        quill.log.warn('No remote keys for: ' + settings.keyhost.magenta);
        return checkLocalKeys(false);
      }
      
      quill.log.info('Remote keys found for: ' + settings.keyhost.magenta);
      checkLocalKeys(true);
    });
  }
  
  if (!settings) {
    return checkKeyhost(function (err, results) {
      if (err) {
        return callback(err);
      }
      
      settings = results;
      checkRemoteKeys();
    });
  }
  
  checkRemoteKeys();
};

keys.create.usage = [
  'Creates the SSH keys for the current machine and uploads',
  'them to Rackspace.',
  '',
  'quill keys create'
];

//
// ### function list (pattern, callback)
// #### @pattern {string} **Optional** Pattern to search for within keys
// #### @callback {function} Continuation to respond to when complete.
// Lists all keys in the current environment, filtering them by 
// `pattern` (if specified).
//
keys.list = function (pattern, callback) {
  if (!callback) {
    callback = pattern;
    pattern = null;
  }
  
  var env = quill.config.get('env'),
      rackspace = createRackspace(),
      keysContainer = quill.config.get('rackspace:keysContainer');
        
  rackspace.cloudfiles.setAuth(function () {
    rackspace.cloudfiles.getFiles(keysContainer, function (err, files) {
      if (err) {
        return callback(err);
      }
      
      quill.log.info('Listing keys in: ' + env.magenta);
      
      if (pattern) {
        quill.log.info('Listing keys matching: ' + pattern.magenta);
      }
      
      files = files.map(function (f) { return f.name })
                   .filter(function (name) { return !pattern || ~name.indexOf(pattern) });
                   
      files.forEach(function (name) { quill.log.data(name) });        
      callback(null, files);
    });
  });
};

keys.list.usage = [
  'Lists all keys in the current environment, filtering them by',
  '`pattern` (if specified).',
  '',
  'quill keys list',
  'quill keys list <pattern>'
];

//
// ### function gethost (callback)
// #### @callback {function} Continuation to respond to when complete. 
// Gets the host for the current machine.
//
keys.gethost = function (callback) {
  var keyhost = quill.config.get('keyhost');

  function showKeyhost (err, host) {
    if (err) {
      return callback(err);
    }
    
    quill.log.data('keyhost'.yellow + ': ' + host.magenta);
    return callback(null, host);
  }

  if (keyhost) {
    return showKeyhost(null, keyhost);
  }
  
  quill.log.warn('No keyhost found. Reading tmpkey.');
  conservatory.common.keys.getHost(true, showKeyhost);
};

keys.gethost.usage = [
  'Gets the host for the current machine.',
  '',
  'quill keys gethost'
];

//
// ### function update (callback)
// #### @callback {function} Continuation to respond to when complete. 
// Updates all keys on all servers in the current environment.
//
keys.update = function (callback) {
  var env = quill.config.get('env'),
      bootstrapper;
  
  //
  // List all servers in the current environment
  //
  conservatory.resources.init({ env: env }, 'server');
  bootstrapper = new conservatory.bootstrap.Rackspace({ env: env });
  conservatory.resources.Server.all(function (err, servers) {
    if (err) {
      return callback(err);
    }
    
    
  });
};