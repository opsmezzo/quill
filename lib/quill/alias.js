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
quill.alias('hostname', { resource: 'keys',    command: 'hostname' });
quill.alias('install',  { resource: 'systems', command: 'install' });
quill.alias('publish',  { resource: 'systems', command: 'publish' });
quill.alias('pack',     { resource: 'systems', command: 'pack' });
quill.alias('list',     { resource: 'systems', command: 'list' });
quill.alias('view',     { resource: 'systems', command: 'view' });
