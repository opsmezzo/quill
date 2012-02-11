/*
 * alias.js: Aliases commands for quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var quill = require('../quill');

//
// Alias the appropriate commands for simplier CLI usage
//
quill.alias('hostname', { resource: 'keys',   command: 'hostname' });
