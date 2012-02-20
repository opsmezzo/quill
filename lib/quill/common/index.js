/*
 * common.js: Common utility functions for quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var flatiron = require('flatiron');

var common = module.exports = flatiron.common.clone(flatiron.common);

common.authorizedKeys = require('./authorized-keys');