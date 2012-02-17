/*
 * properties.js: Properties for the prompts in quill.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

module.exports = {
  yesno: {
    name: 'are you sure?',
    validator: /y[es]?|n[o]?/,
    warning: 'Must respond yes or no',
    default: 'no'
  }
};