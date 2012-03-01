/*
 * composer.js: Common utility functions for working with systems.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var common = require('flatiron').common;
    
var composer = exports;

//
// Hoist submodule helpers onto `composer`.
//
composer.cache = require('./cache');
common.mixin(
  composer, 
  require('./files'),
  require('./tar'),
  require('./remote'),
  require('./dependencies'),
  require('./validate'),
  require('./lifecycle')
);