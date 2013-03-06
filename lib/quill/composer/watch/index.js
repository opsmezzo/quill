/*
 * watch.js: Composer functions that listen for and respond to changes of installed systems 
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var Watcher = require('./watcher');

//
// ### @private _watchers {Object}
// Set of all running watchers.
//
var _watchers = {};

//
// ### function start (action)
// Returns a new `Watcher` for the specified
// lifecycle action.
//
exports.start = function (action, interval) {
  var watcher = new Watcher(action, interval);
  
  process.nextTick(function () {
    watcher.start();
  });
  
  return watcher;
};

//
// ### function stop (watcher)
// Stops the specified `watcher`.
//
exports.stop = function (watcher) {
  var id = watcher.id || watcher;
  
  if (_watchers[id]) {
    _watchers[id].stop();
    delete _watchers[id];
    return true;
  }
  
  return false;
};