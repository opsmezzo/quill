/*
 * images.js: Commands related to images resources
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var path = require('path'),
    eyes = require('eyes'),
    async = require('utile').async,
    request = require('request'),
    cloudservers = require('cloudservers'),
    quill = require('../../quill');
    
var images = exports;

images.usage = [
  '`quill images *` commands are for working with',
  'and creating new images for use in various IaaS cloud providers',
  '',
  'quill images create <server-name>',
  'quill images destroy <id>',
  'quill images listraw',
  'quill images listraw <pattern>',
  'quill images set',
  'quill images set <pattern>'
];

//
// ### function (name, callback)
// #### @name {string} Name of the server to create the image from
// #### @callback {function} Continuation to pass control to when complete.
// Creates an image in Rackspace Cloudservers from the server with the specified `name`.
//
images.create = function (name, callback) {
  if (!callback) {
    callback = name;
    quill.log.error('Missing required argument to `images create`: <server-name>');
    return callback(new Error(), true);
  }
  
  var env = quill.config.get('env'),
      auth = quill.config.get('rackspace:auth'),
      client = cloudservers.createClient({ auth: auth });
  
  quill.log.info('Authenticating with Rackspace Cloudservers'); 
  quill.log.info('Using ' + env.magenta + ' environment');
  client.getServers(true, function (err, servers) {
    if (err) {
      return callback(err);
    }
    
    var matches = servers.filter(function (server) {
      return server.name === name;
    });
    
    if (matches.length === 0) {
      return callback(new Error('Cannot find server with name ' + name.magenta), true);
    }
    
    quill.prompt.get(['Image name'], function (err, result) {
      var imageName = result['image name'];
      client.createImage(imageName, matches[0].id, function (err) {
        if (err) {
          return callback(err);
        }
        
        quill.log.info('Created image ' + imageName.magenta + ' from server ' + name.magenta);
        callback();
      });
    })
  })
};

images.create.usage = [
  'Creates an image in Rackspace Cloudservers',
  'from the server with the specified server-name',
  '',
  'quill images create <server-name>'
];

//
// ### function destroy (id, callback)
// #### @id {string} Id of the image to destroy
// #### @callback {function} Continuation to pass control to when complete.
// Destroys an image in Rackspace Cloudservers with the specified `id`.
//
images.destroy = function (id, callback) {
  if (!callback) {
    callback = id;
    quill.log.error('Missing required argument to `images destroy`: <image-id>');
    return callback(new Error(), true);
  }
  
  var env = quill.config.get('env'),
      auth = quill.config.get('rackspace:auth'),
      client = cloudservers.createClient({ auth: auth });
  
  quill.log.info('Authenticating with Rackspace Cloudservers'); 
  quill.log.info('Using ' + env.magenta + ' environment');
  client.destroyImage(id, function (err) {
    if (err) {
      return callback(err);
    }
    
    quill.log.info('Destoryed image ' + id.magenta);
    callback();
  });
};

images.destroy.usage = [
  'Destroys an image from the current IaaS provider with the specified id',
  '',
  'quill images destroy <id>'
];

//
// ### function listimages (pattern, callback)
// #### @pattern {string} **Optional** Regular expression representing the servers to list
// #### @callback {function} Continuation to pass control to when complete.
// Lists all of the images associated with Rackspace Cloudservers. **TODO _(indexzero)_:** Make
// this configurable for multiple service providers.
//
images.listraw = function (pattern, callback) {
  var env     = quill.config.get('env'),
      auth    = quill.config.get('rackspace:auth'),
      client  = cloudservers.createClient({ auth: auth }),
      results = [], regexp;
  
  if (!callback) {
    callback = pattern;
    pattern = null;
  }
  else {
    regexp = new RegExp(pattern, 'i');
  }
  
  quill.log.info('Authenticating with Rackspace Cloudservers'); 
  quill.log.info('Using ' + env.magenta + ' environment');

  client.getImages(function (err, images) {
    if (err) {
      return callback(err);
    }
    
    var rows = [['id', 'name', 'service']],
        colors = ['underline', 'yellow', 'green'];
    
    images.forEach(function (image) {
      if (!pattern || (pattern && regexp.test(image.name))) {
        results.push(image);
        rows.push([
          image.id.toString(),
          image.name,
          'Rackspace'
        ]);
      }
    });
    
    if (rows.length > 1) {
      quill.inspect.putRows('data', rows, colors);
    }
    else {
      quill.log.info('No images found matching ' + pattern.magenta);
    }
    
    callback(null, results);
  });
};

images.listraw.usage = [
  'Lists all images available by the current IaaS service provider',
  '',
  'quill images listraw',
  'quill images listraw <pattern>'
];

//
// ### function set (pattern, callback)
// #### @pattern {string} **Optional** Regular expression representing the servers to list
// #### @callback {function} Continuation to pass control to when complete.
// Lists all of the images associated with Rackspace Cloudservers. Then prompts the user
// for the image to use and the role to use the image for. **TODO _(indexzero)_:** Make
// this configurable for multiple service providers.
//
images.set = function (pattern, callback) {
  function onList (err, images) {
    if (err) {
      return callback(err);
    }
    else if (images.length === 0 && pattern) {
      return callback(new Error('Could not find image.'), true, true);
    }
    
    var name, props = ['role'];
    
    if (images.length > 1) {
      props.unshift('name');
    }
    else {
      name = images[0].name;
    }
    
    quill.prompt.get(props, function (err, result) {
      var key, value, roles, match = images.filter(function (image) {
        return image.name === name || result.name;
      });
      
      if (match.length === 0) {
        quill.log.error('No image with name ' + result.name.magenta);
        return callback();
      }
      
      function setImageForRole (role, next) {
        key = 'images:' + role;
        value = match[0].id.toString();
        quill.log.info('Setting config ' + key.yellow + ' ' + value.magenta);
        quill.commands.config.set(key, value, next);
      }
      
      async.forEach(result.role.split(' '), setImageForRole, callback);
    });
  }
  
  if (!callback) {
    callback = pattern;
    pattern = null;
  }
  
  var args = pattern ? [pattern, onList] : [onList];
  images.listraw.apply(null, args);
};

images.set.usage = [
  'Lists all images available by the current IaaS service provider,',
  'then prompts the user for the image to use and the role to use the',
  'image for and sets the quill config value.',
  '',
  'quill images set',
  'quill images set <pattern>'
];