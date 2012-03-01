/*
 * cache.js: Cache of systems on the current machine.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var common = require('flatiron').common,
    async = common.async,
    composer = require('./index');

//
// ### function download (runlist, callback)
// #### @systems {Array|Object|string} List of systems to download to the target machine.
// #### @callback {function} Continuation to respond to when complete.
//
exports.download = function (systems, callback) {
  //
  // Downloads one system to the cache for quill.
  //
  function downloadOne(system, next) {
    //
    // TODO: Download stuff.
    //
    next();
  }
  
  composer.runlist(systems, function (err, runlist) {
    return err ? callback(err) : async.forEach(runlist, downloadOne, function (err) {
      return err ? callback(err) : callback(null, runlist);
    })
  });
};