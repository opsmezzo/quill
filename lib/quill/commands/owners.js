/*
 * owners.js: Commands related to working with system owners.
 *
 * (C) 2012, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    quill = require('../../quill');

var owners = exports;

owners.usage = [
  '`quill owners` commands allow you to add, remove, or list system owners',
  '',
  'quill owners add    <system> <user>',
  'quill owners remove <system> <user>',
  'quill owners rm     <system> <user>',
  'quill owners list   <system>',
  'quill owners ls     <system>'
];

//
// ### function create (system, user, callback)
// Adds the `user` as an owner to the specified `system`.
//
owners.add = function (system, user, callback) {
  if (!system || !user) {
    quill.log.error('<system> and <user> are required');
    quill.log.help('usage: quill owners add <system> <user>');
    return callback(true, true, true);
  }
  
  quill.log.info('Adding ' + user.magenta + ' to ' + system.yellow);
  quill.systems.addOwner(system, user, callback);
};

//
// Usage for `quill owners add <system> <name>
//
owners.add.usage = [
  'Adds the <user> as an owners to the specified <system>.',
  '',
  'quill owners add <system> <user>'
];

//
// ### function remove (system, user, callback)
// Removes the `user` as an owner from the specified `system`.
//
owners.remove = owners.rm = function (system, user, callback) {
  if (!system || !user) {
    quill.log.error('<system> and <user> are required');
    quill.log.help('usage: quill owners remove <system> <user>');
    return callback(true, true, true);
  }
  
  quill.log.info('Removing ' + user.magenta + ' from ' + system.yellow);
  quill.systems.removeOwner(system, user, callback);
};

//
// Usage for `quill owners remove <system> <name>
//
owners.remove.usage = [
  'Removes the <user> as an owner from the specified <system>.',
  '',
  'quill owners remove <system> <user>',
  'quill owners rm     <system> <user>'
];

//
// ### function list (system, user, callback)
// Lists the owners of the specified `system`.
//
owners.list = owners.ls = function (name, callback) {
  if (!name) {
    quill.log.error('<system> is required.');
    quill.log.help('usage: quill owners list <system>');
    return callback(true, true, true);
  }
  
  quill.log.info('Listing owners for ' + name.yellow);
  quill.systems.get(name, function (err, system) {
    if (err) {
      return callback(err);
    }
    else if (!system.maintainers || !system.maintainers.length) {
      quill.log.warn('No maintainers found');
      return callback();
    }
    
    quill.log.data(system.maintainers.join(', '));
    callback();
  });
};

//
// Usage for `quill owners list <system> <name>
//
owners.list.usage = [
  'Lists the owners of the specified <system>.',
  '',
  'quill owners list <system>',
  'quill owners ls   <system>'
];