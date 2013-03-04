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
composer.cache     = require('./cache');
composer.config    = require('./config');
composer.history   = require('./history');
composer.template  = require('quill-template').template;
composer.installed = require('./installed');
common.mixin(
  composer,
  require('./dependencies'),
  require('./files'),
  require('./format'),
  require('./lifecycle'),
  require('./remote'),
  require('./tar'),
  require('./validate')
);
