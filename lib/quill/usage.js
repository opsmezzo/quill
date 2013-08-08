/*
 * usage.js: Text for `jitsu help`.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var colors = require('colors');

module.exports = [
  '   ___'.cyan,
  '  /  / /  / / /   /'.cyan,
  ' /_\\/ /__/ / /__ /__'.cyan,
  '',

  'Flawless configuration of your cloud',
  '',

  'Usage:'.cyan.bold.underline,
  '',
  '  quill <resource> <action> <param1> <param2> ...',
  '',

  'Commands:'.cyan.bold.underline,
  '',
  '  quill installed',
  '  quill keys',
  '  quill owners',
  '  quill remote',
  '  quill systems',
  '  quill users'
];
