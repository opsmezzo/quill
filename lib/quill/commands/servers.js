/*
 * servers.js: Commands related to server resources
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    neuron = require('neuron'),
    request = require('request'),
    cloudfiles = require('cloudfiles'),
    cloudservers = require('cloudservers'),
    quill = require('../../quill'),
    async = quill.common.async,
    conservatory = require('../../../vendor/conservatory');

var servers = exports;

servers.usage = [
  '`quill servers *` commands work with raw and managed server resources',
  '',
  'quill servers create',
  'quill servers createimage',
  'quill servers createraw',
  'quill servers run',
  'quill servers test <role>',
  'quill servers listraw',
  'quill servers listraw <pattern>',
  'quill servers rename <id> <name>',
  'quill servers delete <id>'
];

//
// Default properties to use when creating servers
//
var createProperties = [
  {
    name: 'role',
    message: 'Role for this server (master, etc.)',
    validator: function (str) {
      return ~['master', 'slave', 'provisioner', 'balancer', 'redis', 'couch'].indexOf(str.trim())
    },
    warning: 'Role must be one of: master, slave, provisioner, balancer, redis, couch',
    empty: false
  },
  {
    name: 'name',
    message: 'Name of this server',
    validator: /^[\w_-]/,
    empty: false
  }
];

//
// Default properties when creating many servers.
//
var batchProperties = [
  {
    name: 'length',
    message: 'Number of servers to create',
    validator: /^\d+/,
    warning: 'Must be a number',
    empty: false
  },
  {
    name: 'batchSize',
    message: 'Number of servers per batch',
    validator: /^\d*/,
    warning: 'Must be a number',
    default: 5
  }
];

//
// #### @private function imageProperty (role)
// #### @role {string} Role to create the property list for.
// Returns a property to use with `node-prompt` for the
// imageId of a server with the specified `role`.
//
function imageProperty (role) {
  var defaultId = quill.config.get('images:' + role)
    || quill.config.get('roles:' + role + ':imageId')

  return [
    {
      name: 'imageId',
      description: 'Server Image Id (if any)',
      default: defaultId,
      validator: /\d*/
    }
  ]
}

//
// #### @private function createServer (options, callback)
// #### @options {Object} Options to use when creating this server.
// #### @callback {function} Continuation to respond to when complete.
// Prompts the user for `role` and `name` of a server to create, then creates
// that server in the environment specified by `quill.config.get('env')`.
//
function createServer (options, callback) {
  var env         = quill.config.get('env'),
      auth        = quill.config.get('rackspace:auth'),
      database    = quill.config.get('database'),
      imageServer = options.imageServer, 
      role        = options.role,
      name        = options.name,
      systemName  = quill.config.get('roles:' + role + ':system');

  conservatory.resources.init({ env: env }, 'server');
  
  var servers   = [],
      rackspace = new (conservatory.bootstrap.Rackspace)({ env: env }),
      bootstrap = imageServer ? rackspace.createImageServer : rackspace.startServer,
      action    = imageServer ? 'create' : 'start',
      startOptions,
      runner;

  function getId(role, address) {
    return role + '_' + address;
  }

  function insertServer(role, server, done) {
    //
    // Create a document for the newly created server
    //
    var realRole = role === 'slave' ? 'free' : role,
        idRole = imageServer ? [role, 'image'].join('-') : realRole,
        data;

    data = {
      _id: getId(idRole, server.addresses.public[0]),
      system: quill.config.get('roles:' + role + ':system'),
      keyfile: path.basename(server.keyfile),
      role: imageServer ? role : realRole,
      usage: 0
    };

    if (imageServer) {
      data.image = true;
    }

    Object.keys(server).forEach(function (key) {
      if (['hostId', 'client', 'metadata', 'progress', 'status', 'keyfile'].indexOf(key) === -1) {
        data[key] = server[key];
      }
    });

    quill.log.info('Attempting to insert ' + server.name + ' into CouchDB at: ' + database.host + ':' + database.port);
    quill.inspect.putObject(data);
    conservatory.resources.Server.model.create(data, function (err, result) {
      if (err) {
        quill.log.error('Error inserting server into CouchDB');
        quill.inspect.putObject(err);
      }

      done();
    });
  }

  function onError(err) {
    quill.log.error('Error starting server ' + name.magenta);
    callback(err);
  }

  function onCreate(server) {
    quill.log.info('Created server ' + server.name.magenta);
    quill.log.data('Address:  ' + server.addresses.public[0]);
    quill.log.data('Password: ' + server.adminPass);

    insertServer(role, server, function () {
      quill.log.info('Inserted ' + server.name + ' into CouchDB at: ' + database.host + ':' + database.port);
      quill.log.info('Waiting for server ' + server.name.magenta + ' to become active.');
    });
  }

  function onComplete(server) {
    quill.log.info('Successfully ran action ' + action.yellow + ' on:' + name);
    quill.log.data('Address:  ' + server.addresses.public[0]);
    quill.log.data('Password: ' + server.adminPass);
    callback();
  }

  startOptions = {
    env:    env,
    role:   role,
    silent: false,
    name:   name
  };

  var image = parseInt(options.imageId, 10) || quill.config.get('images:' + role);

  if (!image) {
    image = quill.config.get('roles:' + role + ':imageId');
  }

  startOptions.flavorId  = quill.config.get('roles:' + role + ':flavorId');
  startOptions.system    = conservatory.bootstrap.systems[systemName];
  startOptions.imageId   = image;

  quill.log.info('Using image id ' + image.toString().magenta);
  quill.log.info('Using flavor id ' + startOptions.flavorId.toString().magenta);
  quill.log.info('Using system ' + systemName.magenta);

  quill.log.info('Attempting to ' + action.yellow + ' server ' + startOptions.name + ' with role ' + role + ' in ' + env + ' environment');
  bootstrap.call(rackspace, startOptions)
       .on('error', onError)
       .on('create', onCreate)
       .on('start', onComplete)
       .on('complete', onComplete);
}

function getServerDetails (imageServer, callback) {
  quill.prompt.get(createProperties, function (err, result) {
    if (err) {
      return callback(err);
    }
    else if (imageServer) {
      return quill.prompt.get(imageProperty(result.role), function (err, imageResult) {
        if (err) {
          return callback(err);
        }

        result.imageId = imageResult.imageId;
        callback(null, result);
      });
    }

    callback(null, result);
  });
}

//
// ### function create (callback)
// #### @callback {function} Continuation to pass control to when complete.
// Prompts the user for `role` and `name` of a server to create, then creates
// that server in the environment specified by `quill.config.get('env')`.
//
servers.create = function (callback) {
  getServerDetails(false, function (err, result) {
    if (err) {
      return callback(err);
    }
    
    result.imageServer = false;
    createServer(result, callback);
  })
};

servers.create.usage = [
  'Creates a server in the target environment with the',
  'name and role specified by prompt.',
  '',
  'quill servers create'
];

//
// ### function createimage (callback)
// #### @callback {function} Continuation to pass control to when complete.
// Prompts the user for `role` and `name` of an image server to create, then creates
// that server in the environment specified by `quill.config.get('env')`.
//
servers.createimage = function (callback) {
  getServerDetails(true, function (err, result) {
    if (err) {
      return callback(err);
    }
    
    result.imageServer = true;
    createServer(result, callback);
  });
};

servers.createimage.usage = [
  'Creates an image server in the target environment with the',
  'name and role specified by prompt.',
  '',
  'quill servers createimage'
];

//
// ### function createbatch (callback)
// #### @callback {function} Continuation to respond to when complete
// Creates a batch of servers by prompting the user for the number of 
// servers to create and the size of the batch to use.
//
servers.createbatch = function (callback) {
  //
  // Helper function for creating all servers in 
  // batches of a specified size
  //
  function createAllBatches (result, batch) {
    var length = parseInt(batch.length, 10),
        size = parseInt(batch.batchSize, 10),
        started = 0,
        created = 0;
    
    quill.log.info('Creating ' + length + ' servers');
    quill.log.info('In batches of ' + size);
    
    //
    // Create and configure a `neuron` JobManager responsible
    // for creating individual servers.
    //
    var manager = new neuron.JobManager({ concurrency: size });
    manager.addJob('create-server', {
      work: function () {        
        var options = quill.common.clone(result),
            that = this;
        
        options.name = options.name + started;
        started += 1;
        
        createServer(options, function () {
          created += 1;
          that.finished = true;
        });
      }
    });
    
    manager.on('finish', function (job, worker) {
      //
      // If all creation of all servers have not yet been
      // started then enqueue another worker.
      //
      if (started < length) {
        manager.enqueue('create-server')
      }
      
      //
      // If we have created all servers then respond
      // to the `callback`.
      //
      if (created >= length) {
        callback();
      }
    });

    //
    // Enqueue the first batch of workers for
    // creating servers.
    //
    for (var i = 0; i < size; i++) {
      manager.enqueue('create-server');
    }
  }
  
  getServerDetails(false, function (err, result) {
    if (err) {
      return callback(err);
    }
    
    result.imageServer = false;
    quill.prompt.get(batchProperties, function (err, batch) {
      return err ? callback(err) : createAllBatches(result, batch);
    });
  });
};

servers.createbatch.usage = [
  'Creates a batch of servers by prompting the user for the number of',
  'servers to create and the size of the batch to use.',
  '',
  'quill servers createbatch'
];

//
// ### function createraw (callback)
// #### @callback {function} Continuation to pass control to when complete.
// Creates a raw server (i.e. no required files or packages) with the image
// and role specified in the configuration for the role provided by prompt.
//
servers.createraw = function (callback) {
  quill.prompt.get(['name', 'role'], function (err, result) {
    var env = quill.config.get('env'),
        rackspace    = quill.config.get('rackspace'),
        client       = cloudservers.createClient({ auth: rackspace.auth }),
        config       = quill.config.get('roles:' + result.role)
        bootstrapper = new conservatory.bootstrap.Rackspace({ env: env }),
        keyfile      = path.join(quill.config.get('directories:keys'), result.name);

    bootstrapper.createAndUploadKeys(keyfile, function (err, keys) {
      if (err) {
        return callback(err);
      }

      var options = {
        name:        result.name,
        image:       config.imageId,
        flavor:      config.flavorId,
        personality: [{
          path:     '/root/.ssh/authorized_keys',
          contents: keys.public.data.toString('base64')
        }]
      };

      client.createServer(options, function (err, server) {
        if (err) {
          return callback(err);
        }

        quill.log.info('Server created ' + result.name.magenta);
        quill.log.data('Address:  ' + server.addresses.public[0]);
        quill.log.data('Password: ' + server.adminPass);
        quill.log.info('Waiting for ' + result.name.magenta + ' to become active');
        server.setWait({ status: 'ACTIVE' }, 3000, function () {
          quill.log.silly('Server ' + result.name.magenta + ' created successfully');
          callback();
        });
      });
    });
  });
};

servers.createraw.usage = [
  'Creates a raw server (i.e. no required files or packages) with the image',
  'and role specified in the configuration for the role provided by prompt.',
  '',
  'quill servers createraw'
];

//
// ### function run (callback)
// #### @callback {function} Continuation to pass control to when complete.
// Prompts the user for a role and commands to run, then runs the specified
// commands on all servers in the environment indicated by `quill.config.get('env')`.
//
servers.run = function (callback) {
  var env          = quill.config.get('env'),
      auth         = quill.config.get('rackspace:auth'),
      keysDir      = quill.config.get('directories:keys'),
      client       = cloudfiles.createClient({ auth: auth }),
      bootstrapper;

  quill.prompt.get(['commands', 'role'], function (err, result) {
    var commands = result.commands,
        role     = result.role,
        keyfile;

    function runOnServer(server) {
      var targetRole = server.role === 'free' ? 'slave' : server.role,
          worker = this;

      // Ignore CouchDB servers and if the server
      // doesn't match the target role, return
      if (role === 'couch' || (role && targetRole !== role) || server.image) {
        return this.finished = true;
      }

      server.keyfile = keyfile;
      quill.log.info('Attempting to contact server ' + server.name + ' at ' + server.addresses.public[0]);
      var runner = bootstrapper.ssh({ server: server, commands: commands });

      runner.on('error', function (err) {
        quill.log.error('Error updating server at ' + server.addresses.public[0]);
        quill.log.error(err.message);
        worker.finished = true;
      });

      runner.on('complete', function () {
        quill.log.info('Updated server ' + server.name.magenta + ' at ' + server.addresses.public[0]);
        worker.finished = true;
      });
    }
    
    function runOnServers (servers) {
      var manager = new neuron.JobManager({ concurrency: 75 }),
          length = servers.length,
          finished = 0;
      
      manager.addJob('runOnServer', {
        work: runOnServer
      });
      
      servers.forEach(function (server) {
        manager.enqueue('runOnServer', server);
      });
      
      manager.on('finish', function () {
        finished += 1;
        //
        // If we have run on all servers then 
        // respond to the `callback`.
        //
        if (finished >= length) {
          callback();
        }
      });
    }

    function getSshKey (done) {
      quill.commands.keys.gethost(function (err, keyhost) {
        if (err) {
          return callback(err);
        }

        keyfile = path.join(keysDir, keyhost);
        exec('chmod 0600 ' + keysDir + '/*', function () {
          fs.stat(keyfile, function (err, stats) {
            if (err || (stats && !stats.isFile())) {
              quill.log.error('No key file for keyhost: ' + keyhost.magenta);
              quill.log.error('Run `quill keys create` and retry.');
              return done(err || new Error('No keyhost for: ' + keyhost));
            }

            done();
          });
        });
      });
    }

    //
    // Grab the SSH key for the current machine
    //
    getSshKey(function (err) {
      if (err) {
        return callback(err);
      }

      //
      // List all servers in the current environment
      //
      conservatory.resources.init({ env: env }, 'server');
      bootstrapper = new conservatory.bootstrap.Rackspace({ env: env }),
      conservatory.resources.Server.model.all(function (err, servers) {
        return err ? callback(err) : runOnServers(servers);
      });
    });
  });
};

servers.run.usage = [
  'Runs the commands specified on all servers',
  'with the target role in target environment',
  '',
  'quill servers run'
];

//
// ### function test (role, callback)
// #### @role {string} Role of the server to test.
// #### @callback {function} Continuation to pass control to when complete.
// Tests the servers with the specified role in the environment
// indicated by `quill.config.get('env')`.
//
servers.test = function (role, callback) {
  if (!callback) {
    callback = role;
    return callback(new Error('role is required'), true, true);
  }

  var env = quill.config.get('env'), 
      responded = false, 
      count = 0,
      tester;

  //
  // Setup the test assertions for various roles in the Nodejitsu platform.
  //
  tester = {
    test: function (server, port, role, done) {
      var url = '/',
          address = server.addresses.public[0];

      if (role === 'master') {
        url += 'version'
      } 
      else if (role === 'slave') {
        url += 'drones';
      }

      if (server.image) {
        quill.log.warn('Skipping image server: ' + server.name.yellow + ' at ' + address);
        return done();
      }
      
      request({ uri: 'http://' + address + ':' + port + url, timeout: 10000 }, function (err, res, body) {
        var message;
        
        if (err) {
          quill.log.error([
            role.magenta,
            'server',
            server.name.yellow,
            'with id',
            server._id,
            'did not respond.'
          ].join(' '), done);
        }
        else if (res.statusCode === 200 || res.statusCode === 404) {
          message = [
            role.magenta,
            'server',
            server.name.yellow,
            'with id',
            server._id
          ];
                    
          if (role === 'slave') {
            var result = JSON.parse(body);
            message.push(' [drones: ' + Object.keys(result.drones).length + ']');
          }
          
          quill.log.info(message.join(' '), done)
        }
      });
    },

    slave: function (server, done) {
      this.test(server, 9002, 'slave', done);
    },

    master: function (server, done) {
      this.test(server, 80, 'master', done);
    },

    balancer: function (server, done) {
      this.test(server, 80, 'balancer', done);
    }
  };

  conservatory.resources.init({ env: env }, 'server');
  conservatory.resources.Server.model.all(function (err, results) {
    if (err) {
      return callback(err);
    }

    function testResult(result, next) {
      var that = this,
          server = result._properties,
          targetRole = server.role === 'free' ? 'slave' : server.role;

      if (targetRole === role) {
        count++;
        tester[role](server, function () {
          that.finished = true;
        });
      }
      else {
        that.finished = true
      }
    }

    function respond() {
      if (!responded) {
        responded = true;
        quill.log.info('Done testing ' + count + ' servers');
        callback();
      }
    }

    var manager = new neuron.JobManager({ concurrency: 50 }),
        length = results.length,
        finished = 0;
    
    manager.addJob('testServer', {
      work: testResult
    });
    
    results.forEach(function (result) {
      manager.enqueue('testServer', result);
    });
    
    manager.on('finish', function () {
      finished += 1;
      //
      // If we have run on all servers then 
      // respond to the `callback`.
      //
      if (finished >= length) {
        callback();
      }
    });
  });
};

servers.test.usage = [
  'Tests to see if all servers with the specified',
  'role are currently running.',
  '',
  'quill servers test <role>'
];

//
// ### function listraw (pattern, callback)
// #### @pattern {string} **Optional** Regular expression representing the servers to list
// #### @callback {function} Continuation to pass control to when complete.
// Returns the raw servers from the specified server provider. **TODO _(indexzero)_:** Make
// this configurable for multiple service providers.
//
servers.listraw = function (pattern, callback) {
  var env = quill.config.get('env'),
      auth = quill.config.get('rackspace:auth'),
      client = cloudservers.createClient({ auth: auth });

  if (!callback) {
    callback = pattern;
    pattern = null;
  }

  quill.log.info('Authenticating with Rackspace Cloudservers');
  quill.log.info('Using ' + env.magenta + ' environment');

  client.getServers(true, function (err, servers) {
    if (err) {
      return callback(err);
    }
    
    var rows = [['id', 'name', 'status', 'address']],
        colors = ['bold', 'underline', 'yellow', 'green'],
        regexp;

    if (pattern) {
      regexp = new RegExp(pattern, 'i');
    }

    servers.forEach(function (server) {
      if (!regexp || (regexp && regexp.test(server.name))) {
        rows.push([
          server.id,
          server.name,
          server.status,
          server.addresses.public[0],
        ]);
      }
    });

    quill.inspect.putRows('data', rows, colors);
    callback(null, servers);
  });
};

servers.listraw.usage = [
  'Lists all servers in the specified environment',
  'by contacting the IaaS service provider directly',
  '',
  'quill servers listraw',
  'quill servers listraw <pattern>'
];

//
// ### function list (pattern, callback)
// #### @pattern {string} Pattern to list roles against.
// #### @callback {function} Continuation to respond to when complete.
// Lists all servers in the database for the current environment, filtering
// by the `pattern` if specified.
//
servers.list = function (pattern, callback) {
  if (!callback) {
    callback = pattern;
    pattern = null;
  }

  var env = quill.config.get('env');

  //
  // List all servers in the current environment
  //
  conservatory.resources.init({ env: env }, 'server');
  bootstrapper = new conservatory.bootstrap.Rackspace({ env: env });
  conservatory.resources.Server.model.all(function (err, servers) {
    if (err) {
      return callback(err);
    }

    quill.log.info('Listing ' + servers.length + ' servers');
    var rows = [['name', 'role', 'system', 'address']],
        colors = ['underline', 'yellow', 'yellow', 'green'],
        regexp;

    if (pattern) {
      regexp = new RegExp(pattern, 'i');
    }

    servers.forEach(function (server) {
      if (!regexp || (regexp && regexp.test(server.role))) {
        rows.push([
          server.name,
          server.role,
          server.system,
          server.addresses.public[0],
        ]);
      }
    });

    quill.inspect.putRows('data', rows, colors);
    callback(null, servers);
  });
};

servers.list.usage = [
  'Lists all servers in the database for the current environment, filtering',
  'by the `pattern` if specified.',
  '',
  'quill servers list'
];

servers.rename = function (id,name,callback) {
  var env = quill.config.get('env'),
      auth = quill.config.get('rackspace:auth'),
      client = cloudservers.createClient({ auth: auth });

  quill.log.info('Authenticating with Rackspace Cloudservers');
  quill.log.info('Using ' + env.magenta + ' environment');

  client.renameServer(id, name, function (err) {
    if (err) {
      return callback(err);
    }
    quill.log.info('Server renamed to : ' + name);
    callback();
  });
}

servers.rename.usage = [
  'Rename a server in the specified environment',
  '',
  'quill servers rename <id> <name>'
];

servers.move = function (role, target, callback) {
  var env = quill.config.get('env'),
      auth = quill.config.get('rackspace:auth'),
      database = quill.config.get('database'),
      client = cloudservers.createClient({ auth: auth });

  conservatory.resources.init(database, 'server');
  conservatory.resources.Server.model.forRole(role, function (err, servers) {
    function moveServer (server, next) {
      if (/image_/.test(server._id)) {
        return next();
      }
      
      quill.log.info('Moving server ' + server._id);
      conservatory.resources.Server.model.destroy(server._id, function (err, result) {
        var clone = quill.log.clone(server.properties);
        clone.role = target;
        clone._id = target + '_' + server.addresses.public[0];
        delete clone._rev;

        conservatory.resources.Server.model.create(clone, function () {
          next();
        });
      });
    }


    async.forEachSeries(servers, moveServer, function () {
      callback();
    });
  });
};


servers.move.usage = [
  'Move a server of the specified role to another role'
];

servers.delete = function (id, callback) {
  var env = quill.config.get('env'),
      auth = quill.config.get('rackspace:auth'),
      database = quill.config.get('database'),
      client = cloudservers.createClient({ auth: auth });

  conservatory.resources.init({ env: env }, 'server');

  quill.log.info('Attempting to delete server ' + id + ' from CouchDB at: ' + database.host + ':' + database.port);
  conservatory.resources.Server.model.get(id, function (err, server) {
    if (err && !quill.config.get('ignoredb')) {
      quill.log.error('Error retrieving server from CouchDB');
      return callback(err);
    }

    conservatory.resources.Server.model.destroy(id, function (err, result) {
      if (err && !quill.config.get('ignoredb')) {
        quill.log.error('Error deleting server from CouchDB');
        return callback(err);
      }

      quill.log.info('Authenticating with Rackspace Cloudservers');
      quill.log.info('Using ' + env.magenta + ' environment');

      client.setAuth(function () {
        quill.log.info('Attempting to destroy: ' + server.name.magenta);
        client.destroyServer(server.id, function (err) {
          if (err) {
            return callback(err);
          }

          quill.log.info('Server ' + id + ' deleted');
          callback();
        });
      });
    });
  });
}

servers.delete.usage = [
  'Delete a server from the specified environment',
  '',
  'quill servers delete <id>',
  '',
  '--ignoredb          ignore errors when deleting the server from CouchDB'
];


servers.purge = function (callback) {
  function purgeServer(server, next) {
    quill.log.info('Purging server ' + [server.name.magenta, server._id.yellow].join(': '));
    conservatory.resources.Server.model.destroy(server._id, function () {
      next();
    });
  }

  function purgeServers(raw, servers) {
    var zombies;

    zombies = servers.filter(function (server) {
      return !raw.some(function (r) {
        return r.name === server.name
          && r.addresses.public[0] === server.addresses.public[0]
      });
    });

    if (zombies.length === 0) {
      quill.log.warn('No servers need purging');
      return callback();
    }

    async.forEach(zombies, purgeServer, callback);
  }

  quill.log.info('Listing servers from the database.')
  quill.commands.servers.list(function (err, servers) {
    if (err) {
      return callback(err);
    }

    quill.log.info('Listing raw servers from Rackspace Cloudservers.')
    quill.commands.servers.listraw(function (err, raw) {
      return err ? callback(err) : purgeServers(raw, servers);
    });
  });
};

servers.stopfree = function (callback) {
  var env = quill.config.get('env'),
      misnamed = [];
  
  conservatory.resources.init({ env: env }, 'app', 'server');

  function stopFree (server, next) {
    var uri = 'http://' + server.addresses.public[0] + ':9002/drones/cleanall';
    quill.log.info('Contacting ' + server._id.magenta);
    request({ uri: uri, method: 'POST', timeout: 10000 }, function (err, res, body) {
      if (err) {
        console.dir(err);
      }
      else {
        console.dir(JSON.parse(body));
      }
      next();
    });
  }
  
  quill.log.info('Listing all Servers');
  conservatory.resources.Server.model.forRole('free', function (err, servers) {
    async.forEachSeries(servers, stopFree, callback);
  });
};
