/*
 * files.js: Commands related to packaging relevant quill files.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    async = require('utile').async,
    cloudfiles = require('cloudfiles'),
    quill = require('../../quill');

var containers = exports;

containers.usage = [
  '`quill container *` commands will work with IaaS containers',
  '(i.e. containers in Rackspace or Buckets in AWS)',
  '',
  'quill containers createall',
  'quill containers clean <container-name>'
];

//
// ### function createall (callback)
// #### @callback {function} Continuation to pass control to when complete.
// Creates all containers in the specified environment listed in quill config.
//
containers.createall = function (callback) {
  var env = quill.config.get('env'),
      rackspace = quill.config.get('rackspace'),
      client = cloudfiles.createClient({ auth: rackspace.auth }),
      containers = [];

  quill.log.info('Authenticating with Rackspace Cloudservers'); 
  quill.log.info('Using ' + env.magenta + ' environment');

  Object.keys(rackspace).forEach(function (key) {
    if (/container/i.test(key)) {
      containers.push(rackspace[key]);
    }
  });

  function createContainer (container, next) {
    quill.log.info('Creating container ' + container.magenta);
    client.createContainer(container, function (err) {
      return err ? next(err) : next();
    });
  }

  quill.log.info('Creating containers: ' + containers.map(function(c) { return c.yellow } ).join(', '));
  client.setAuth(function () {
    async.forEach(containers, createContainer, callback);    
  });
};

containers.createall.usage = [
  'Creates all containers in the specified environment listed',
  'in quill config.',
  '',
  'quill containers createall'
];

//
// ### function clean (container, callback)
// #### @container {string} Name of the container to clean.
// #### @callback {function} Continuation to pass control to when complete.
// Uploads all relevant files for node.js images to Rackspace Cloudfiles.
//
containers.clean = function (container, callback) {
  var env = quill.config.get('env'),
      auth = quill.config.get('rackspace:auth'),
      client = cloudfiles.createClient({ auth: auth });

  if (!callback) {
    callback = container;
    quill.log.error('Missing required arguments for `containers clean`: <container-name>');
    return callback(new Error(), true);
  }
  quill.log.info('Authenticating with Rackspace Cloudservers'); 
  quill.log.info('Using ' + env.magenta + ' environment');

  client.setAuth(function () {
    var completed = 0;
    quill.log.info('Listing files in ' + container.magenta);
    client.getFiles(container, false, function (err, files) {
      if (err) {
        return callback(err);
      }
      
      var buckets = [];
      while (files.length > 0) {
        buckets.push(files.splice(0, 20));
      }
      
      function destroyFiles (files, next) {
        quill.log.info('Destroying '.yellow + files.length + ' files from ' + files[0].container.yellow);
        async.forEach(files, function (file, done) {
          quill.log.info('Destroying'.yellow + ' file ' + file.name.magenta + ' from ' + file.container.yellow);
          client.destroyFile(file.container, file.name, function (err) {
            if (err) {
              quill.log.error('Error destroying file ' + file.name.magenta + ' ' + err.message.red);
            }
            
            quill.log.info('Destroyed'.red + ' file ' + file.name.magenta + ' ' + file.container.yellow);
            done();
          });
        }, next);
      }

      quill.log.info('Destroying ' + files.length + ' from ' + container.magenta);
      quill.log.info('Using ' + buckets.length + ' file sets of 20');
      async.forEachSeries(buckets, destroyFiles, function (err) {
        return err ? callback(err) : callback();
      });
    });
  });
};

containers.clean.usage = [
  'Destroys all files from the specified container from',
  'the active Iaas provider.',
  '',
  'quill containers clean <container-name>'
];