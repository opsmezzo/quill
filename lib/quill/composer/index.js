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
  require('./dependencies'),
  require('./files'),
  require('./lifecycle'),
  require('./remote'),
  require('./tar'),
  require('./validate')
);