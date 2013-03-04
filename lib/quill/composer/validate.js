/*
 * validate.js: Common utility functions for validating systems and system dependencies.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var async = require('flatiron').common.async,
    composer = require('./index')
    quill = require('../../quill');
    
exports.validateSystem = function (system, os) {
  var lists = {
    dependencies: Object.keys(system.dependencies || {}),
    remote:       Object.keys(system.remoteDependencies || {}),
    os:           []
  };

  if (typeof system.os === 'object' && system.os[os]) {
    lists.os = system.os.runlist || system.os.dependencies
      ? system.os.runlist || Object.keys(system.os.dependencies)
      : Object.keys(system.os[os]);
  }

  //
  // If the system has dependencies but no runlist
  // try to create an implicit runlist. This is only
  // valid for systems with a single dependency.
  //
  if (lists.dependencies.length === 1 && !system.runlist) {
    system.runlist = lists.dependencies;
  }
  
  function logExtraneous(name, prop) {
    quill.log && quill.log.warn([
      system.name.magenta + ':',
      'extraneous',
      name.yellow, 
      'in',
      prop.grey
    ].join(' '));
  }
  
  //
  // Check the dependencies against the runlist.
  //
  lists.dependencies.forEach(function (name) {
    if (!~system.runlist.indexOf(name) && !~lists.os.indexOf(name)
      && !~lists.remote.indexOf(name)) {
      logExtraneous(name, 'dependencies');
    }
  });
  
  //
  // Check the runlist against the dependencies.
  //
  if (system.runlist) {
    system.runlist.forEach(function (name) {
      if ((system.dependencies && !system.dependencies[name])
        && !~lists.remote.indexOf(name)) {
        logExtraneous(name, 'runlist');
      }
    });
  }
};
