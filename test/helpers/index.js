/*
 * index.js: Tests helpers for `quill`.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var path = require('path'),
    quill = require('../../lib/quill');
 
exports.init = function (callback) {
  quill.config.stores.file.file = path.join(__dirname, '..', 'fixtures', 'dot-quillconf');
  quill.config.stores.file.loadSync();
  
  quill.init(quill.setup.bind(quill, callback));
};