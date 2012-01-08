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

var files = exports;

files.usage = [
  '`quill files *` commands will work with files required',
  'on all node.js servers in the Nodejitsu cluster(s)',
  '',
  'quill files upload'
];

//
// ### function upload (container, callback)
// #### @container {string} **Optional** Name of the container to upload the package to
// #### @callback {function} Continuation to pass control to when complete.
// Uploads all relevant files for node.js images to Rackspace Cloudfiles.
//
files.upload = function (container, callback) {
  var env = quill.config.get('env'),
      auth = quill.config.get('rackspace:cloudfiles:auth'),
      systemsDir = quill.config.get('directories:systems'),
      sharedDir =  path.join(systemsDir, 'systems', 'shared'), 
      client = cloudfiles.createClient({ auth: auth });

  if (!callback) {
    callback = container;
    container = quill.config.get('containers:nodeFilesContainer');
  }

  quill.log.info('Listing files in ' + sharedDir.magenta);
  fs.readdir(sharedDir, function (err, files) {
    if (err) {
      return callback(err);
    }
  
    var errs = [], uploaded = 0;
    client.setAuth(function () {
      function uploadFile (file, next) {
        if (['fetch', 'template'].indexOf(file) !== -1) {
          quill.log.warn('Skipping file ' + file.magenta);
          return next();
        }
        
        quill.log.info('Uploading file ' + file.magenta);
        client.addFile(container, {
          remote: file,
          local: path.join(sharedDir, file)
        }, function (err, added) {
          return err ? next(err) : next();
        });        
      }
      
      async.forEach(files, uploadFile, function (err) {
        if (err) {
          return callback(err);
        }
        
        var cacheFile = path.join(__dirname, '..', '..', '..', 'deploy', 'cache.json');
        quill.log.info('Uploading file ' + cacheFile.magenta);
        
        client.addFile(container, {
          remote: 'cache.json',
          local: cacheFile
        }, function (err, added) {
          quill.log.silly('Done uploading files'); 
          callback();
        });
      });
    });
  });
};

files.upload.usage = [
  'Uploads all relevant files for node.js images to Rackspace Cloudfiles.',
  '',
  'quill files upload'
];