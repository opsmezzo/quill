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
  var list = system.dependencies 
    ? Object.keys(system.dependencies)
    : [];
  
  //
  // If the system has dependencies but no runlist
  // try to create an implicit runlist. This is only
  // valid for systems with a single dependency.
  //
  if (list.length === 1 && !system.runlist) {
    system.runlist = list;
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
  list.forEach(function (name) {
    if (!~system.runlist.indexOf(name)) {
      logExtraneous(name, 'dependencies');
    }
  });
  
  //
  // Check the runlist against the dependencies.
  //
  if (system.runlist) {
    system.runlist.forEach(function (name) {
      if (system.dependencies && !system.dependencies[name]) {
        logExtraneous(name, 'runlist');
      }
    });
  }
};
