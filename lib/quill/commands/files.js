/*
 * files.js: Commands related to packaging relevant quill files.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    cloudfiles = require('cloudfiles'),
    quill = require('../../quill'),
    async = quill.common.async,
    conservatory = require('../../../vendor/conservatory');

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
      auth = quill.config.get('rackspace:auth'),
      directory = path.join(process.cwd(), 'vendor', 'nodejitsu', 'lib', 'nodejitsu', 'bootstrap', 'systems', 'shared'), 
      client = cloudfiles.createClient({ auth: auth });

  if (!callback) {
    callback = container;
    container = quill.config.get('rackspace:nodeFilesContainer');
  }

  quill.log.info('Listing files in ' + directory.magenta);
  fs.readdir(directory, function (err, files) {
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
        client.addFile(container, file, path.join(directory, file), function (err, added) {
          return err ? next(err) : next();
        });        
      }
      
      async.forEach(files, uploadFile, function (err) {
        if (err) {
          return callback(err);
        }
        
        var cacheFile = path.join(__dirname, '..', '..', '..', 'deploy', 'cache.json');
        quill.log.info('Uploading file ' + cacheFile.magenta);
        
        client.addFile(container, 'cache.json', cacheFile, function (err, added) {
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