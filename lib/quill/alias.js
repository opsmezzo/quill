/*
 * alias.js: Aliases commands for quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var quill = require('../quill');

//
// Aliases for lifecycle scripts
//
quill.alias('bootstrap', { resource: 'systems', command: 'bootstrap' });
quill.alias('image',     { resource: 'systems', command: 'image' });
quill.alias('update',    { resource: 'systems', command: 'update' });
quill.alias('teardown',  { resource: 'systems', command: 'teardown' });

//
// Alias the appropriate commands for simplier CLI usage
//
quill.alias('hostname',  { resource: 'keys',    command: 'hostname' });
quill.alias('publish',   { resource: 'systems', command: 'publish' });
quill.alias('pack',      { resource: 'systems', command: 'pack' });
quill.alias('list',      { resource: 'systems', command: 'list' });
quill.alias('view',      { resource: 'systems', command: 'view' });
