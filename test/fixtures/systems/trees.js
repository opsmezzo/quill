/*
 * trees.js: Test fixtures for simple and complex dependency trees.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var trees = exports;

//
// Dependency tree with no dependencies
//
trees['no-deps'] = {
  systems: ['no-deps'],
  tree: { 'no-deps@0.1.2': null },
  list: ['no-deps@0.1.2']
};

//
// Dependency tree with two dependencies
//
trees['depends-on-a-b'] = {
  systems: ['depends-on-a-b'],
  tree: { 
    'depends-on-a-b@0.1.2': {
      'a@0.0.1': null,
      'b@0.2.0': null
    }
  },
  list: ['b@0.2.0', 'a@0.0.1', 'depends-on-a-b@0.1.2']
};