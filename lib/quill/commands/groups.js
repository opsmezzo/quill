/*
 * groups.js: Commands related to server group resources
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var async = require('utile').async,
    path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    eyes = require('eyes'),
    neuron = require('neuron'),
    request = require('request'),
    cloudfiles = require('cloudfiles'),
    cloudservers = require('cloudservers'),
    conservatory = require('conservatory'),
    quill = require('../../quill'),
    _ = require('underscore'),
    argv = require('optimist').argv;

var groups = exports;

groups.usage = [
  '`quill groups *` commands work with server groups across multiple providers',
  '',
  'quill groups create <name>',
  'quill groups list <provider>',
  'quill groups view <group>',
  'quill groups add <servers>'
];

var properties = {
  create: [
    {
      name: 'name',
      message: 'Name of the group',
      validator: /[\w_-]+/,
      empty: false
    },
    {
      name: 'provider',
      message: 'Provider for this group (rackspace, joyent, etc)',
      validator: function (str) {
        return ~['rackspace', 'joyent'].indexOf(str.trim())
      },
      warning: 'Role must be one of: rackspace, joyent',
      empty: false
    }
  ],
  rackspace: [
    {
      name: 'username',
      message: 'Rackspace username',
      validator: /[\w]+/,
      empty: false
    },
    {
      name: 'apiKey',
      message: 'Rackspace API Key',
      validator: /[\w]+/,
      empty: false
    }
  ]
};

var modifiers = {
  rackspace: function (group, data) {
    group.provider = group.provider || { name: 'rackspace' };
    group.provider.id = data.username;
    group.provider.username = data.username;
    group.provider.apiKey = data.apiKey;
    return group;
  }
}

groups.create = function (name, callback) {
  if (!callback && typeof name === 'function') {
    callback = name;
    name = null;
  }

  var props = name ? properties.create.slice(1) : properties.create,
      env = quill.config.get('env'),
      group = {};

  conservatory.resources.init({ env: env }, 'group');
  
  if (name) {
    group._id = group.name = name;
  }
  
  function getDetails() {
    quill.prompt.get(properties[group.provider.name], function (err, result) {
      if (err) {
        return callback(err);
      }
      
      group = modifiers[group.provider.name](group, result);
      conservatory.resources.Group.create(group, callback);
    });
  }
  
  quill.prompt.get(props, function (err, result) {
    if (err) {
      return callback(err);
    }

    if (result.name) {
      group._id = result.name;
      group.name = result.name;
    }
    
    group.provider = {
      name: result.provider
    };
    
    getDetails();
  });
};

groups.create.usage = [
  'Creates a group with the specified id. If no id is supplied',
  'you will be prompted for one.',
  '',
  'quill groups create',
  'quill groups create <id>'
];

groups.list = function (provider, callback) {
  if (!callback && typeof provider === 'function') {
    callback = provider;
    provider = null;
  }
  
  var env = quill.config.get('env');
  
  conservatory.resources.init({ env: env }, 'group', 'server');
  
  function showGroups(groups) {
    var rows = [['name', 'provider', 'username', 'api-key']],
        colors = ['underline', 'magenta', 'yellow', 'yellow'];
    
    if (argv.details) {
      rows[0].push('servers');
      colors.push('yellow');
    }
    
    //
    // TODO: Support more than Rackspace here.
    //
    groups.forEach(function (group) {
      var row = [
        group.name,
        group.provider.name,
        group.provider.username,
        group.provider.apiKey
      ];
      
      if (argv.details) {
        row.push(group.servers);
      }
      
      rows.push(row);
    });
    
    quill.inspect.putRows('data', rows, colors);
    callback(null, groups);
  }
  
  function getGroupServers(group, next) {
    conservatory.resources.Server.forGroup(group._id, function (err, servers) {
      if (err) {
        return next(err);
      }
      
      group.servers = servers.length;
      next();
    })
  }
  
  function checkDetails(err, groups) {
    if (err) {
      return callback(err);
    }
    else if (!argv.details) {
      return showGroups(groups);
    }
    
    async.forEach(groups, getGroupServers, function (err) {
      if (err) {
        return callback(err);
      }
      
      return showGroups(groups);
    });
  }
  
  return provider 
    ? conservatory.resources.Group.forProvider(checkDetails)
    : conservatory.resources.Group.all(checkDetails);
};

groups.list.usage = [
  'Lists all groups managed by conservatory.',
  '',
  'quill groups list',
  'quill groups list <provider>'
];

groups.view = function (name, callback) {
  if (!callback) {
    callback = name;
    name = null;
    return callback(new Error('Name of group to view is required.'), true, true);
  }
  
  var env = quill.config.get('env');
  
  conservatory.resources.init({ env: env }, 'group', 'server');
  conservatory.resources.Server.forGroup(name, function (err, servers) {
    if (err) {
      return callback(err);
    }
    
    var rows = [['name', 'role', 'system', 'address']],
        colors = ['underline', 'yellow', 'yellow', 'green'],
        groups;
    
    function sortByName(a, b) {
      var x = a.name.toLowerCase();
      var y = b.name.toLowerCase();
      return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    }
    
    quill.log.info('Listing ' + servers.length + ' servers');
    groups = _.groupBy(servers, function (server) {
      return server.role;
    })
    
    Object.keys(groups).forEach(function (group) {
      groups[group].sort(sortByName).forEach(function (server) {
        rows.push([
          server.name,
          server.role,
          server.system,
          server.addresses.public[0],
        ]);
      });
    });

    quill.inspect.putRows('data', rows, colors);
    callback(null, servers);
  });
};

groups.view.usage = [
  'Views all servers in the specified group.',
  '',
  'quill groups view <group>'
];

groups.add = function (name, callback) {
  if (!callback) {
    callback = name;
    name = null;
    return callback(new Error('Name of servers to add is required'), true, true);
  }
  
  var env = quill.config.get('env'),
      id;
      
  conservatory.resources.init({ env: env }, 'server', 'group');
  
  function addServerToGroup (server, next) {
    quill.log.info('Adding ' + server.name.magenta + ' to group ' + id.yellow);
    conservatory.resources.Server.update(server._id, { group: id }, next);
  }
  
  function listAndAddServers () {
    if (!/[\d+\.]{3}\d+/.test(name)) {
      conservatory.resources.Server.all(function (err, servers) {
        if (err) {
          return callback(err);
        }

        var matcher = new RegExp(name + '.*', 'i');
        servers = servers.filter(function (server) {
          return matcher.test(server.name);
        });

        async.forEachSeries(servers, addServerToGroup, callback);
      });
    }
    else {
      return addServerToGroup(name, callback)
    }
  }
  
  function getGroup() {
    conservatory.resources.Group.get(id, function (err, group) {
      if (err) {
        quill.log.error('Error retreiving group: ' + id.magenta);
        return callback(err, true, true);
      }
      
      listAndAddServers();
    });
  }

  quill.prompt.get(properties.create[0], function (err, result) {
    if (err) {
      return callback(err);
    }
    
    id = result.name;
    getGroup();
  });
};

groups.add.usage = [
  'Adds servers with or matching the <server-name>',
  'to the specified group',
  '',
  'quill groups add <server-name>'
];