/*
 * watcher.js: Watchers for changes on installed systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var events = require('events'),
    fs = require('fs'),
    path = require('path'),
    fstream = require('fstream'),
    semver = require('semver'),
    composer = require('../index'),
    quill = require('../../../quill'),
    common = quill.common,
    async = common.async;

//
// ### function Watcher (action, interval)
// #### @action {string} Lifecycle action to watch.
// #### @interval {number} Interval to check dependencies on.
// Constructor function for the Watcher object responsible for
// watching for and responding to changes in installed systems
// and executing the specified `action`. 
//
var Watcher = module.exports = function Watcher(action, interval) {
  events.EventEmitter.call(this);
  this.action = action;
  this.interval = interval
  this.started = false;
};

//
// Inherit from `events.EventEmitter`.
//
common.inherits(Watcher, events.EventEmitter);

//
// ### function start ()
// Starts watching for changes on the lifecycle action
// on all installed systems.
//
Watcher.prototype.start = function () {
  if (this.started) { return false; }

  this.intervalId = setInterval(
    this.ensureLatest.bind(this),
    this.interval
  );
  
  return true;
};

//
// ### function stop ()
// Stops watching for changes on the lifecycle action
// on all installed systems.
//
Watcher.prototype.stop = function () {
  if (!this.started) { return false; }
  
  clearInterval(this.intervalId);
  this.started = false;
  this.intervalId = null;
  return true;
};

//
// ### function ensureLatest ()
// Ensures that the latest versions of systems are installed
// and executes the lifecycle action if necessary
//
Watcher.prototype.ensureLatest = function () {
  var self = this;

  //
  // If this is a dry-run then simply return
  //
  if (quill.config.get('dry')) {
    return;
  }

  //
  // The watch algorith is:
  // 1. List all installed systems
  // 2. For each installed system.
  //   i. _(Install Latest)_ 
  //     a. **Only when recursive:** If it is a dependency of 
  //        another system ensure that the maximum satisfying
  //        version (semver) is installed.
  //     b. Otherwise it is a "root" dependency and thus
  //        ensure that the absolute latest is installed.
  //   ii. _(Add new remoteDependencies)_
  //     a. If any installed system has remoteDependencies then
  //        reconfigure the system to use the latest config
  // 3. For any updated system run `restart` lifecycle action.
  //
  async.waterfall([
    //
    // 1. List all installed systems
    //
    function listInstalled(done) {
      async.waterfall([
        async.apply(composer.installed.list),
        function getDependencies(installed, next) {
          //
          // Get the dependency tree for all installed
          // systems.
          //
          async.reduce(
            Object.keys(installed),
            {},
            function dependencyTree(all, system, iter) {
              composer.dependencies(system, function (err, deps) {
                if (err) {
                  return iter(err);
                }

                all[system] = deps;
                iter(null, all);
              });
            },
            function (err, trees) {
              return !err
                ? next(null, installed, trees)
                : next(err);                
            }
          );
        }
      ], done);
    },
    //
    // 2. For each installed system.
    //   i. _(Install Latest)_ 
    //
    function installLatest(installed, trees, done) {
      var root = Object.keys(trees).filter(function (system) {
        return !composer.dependencies.of(system, trees);
      });
      
      async.series([
        function updateRoot(next) {
          async.forEachSeries(root, function (system, iter) {
            composer.installed.ensureLatest(installed[system], iter);
          }, next);
        },
        function updateRecursive(next) {
          if (!quill.argv.r && !quill.argv.recursive) {
            return next();
          }
          
          //
          // TODO: Update the recursive dependencies of
          // `root` systems. 
          //
        }
      ], function (err) {
        return !err
          ? done(null, installed, trees, root)
          : done(err);
      });
    },
    //
    // 2. For each installed system.
    //   ii. _(Add new remoteDependencies)_
    //
    function reconfigureRemoteDependencies(installed, trees, updated, next) {
      //
      // TODO: Check remote dependencies.
      //
      next(null, updated);
    },
    //
    // 3. For any updated system run `restart` lifecycle action.
    //
    function restartUpdated(updated, next) {
      //
      // TODO: Restart updated systems.
      //
      next(null, updated);
    }
  ], function (err, updated) {
    return err
      ? self.emit('error', err)
      : self.emit('latest', updated);
  });
};