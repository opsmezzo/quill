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
  tree: { 'no-deps@0.1.2': null },
  list: ['no-deps@0.1.2']
};

//
// Dependency tree with two dependencies
//
trees['depends-on-a-b'] = {
  tree: { 
    'depends-on-a-b@0.1.2': {
      'a@0.0.1': null,
      'b@0.2.0': null
    }
  },
  list: ['b@0.2.0', 'a@0.0.1', 'depends-on-a-b@0.1.2']
};

//
// Dependency tree with dependency in a dependency
//
trees['dep-in-dep'] = {
  tree: { 
    'dep-in-dep@1.0.2': {
      'a@0.0.1': null,
      'b@0.2.0': null,
      'c@0.3.0': {
        'b@0.2.0': null
      }
    }
  },
  list: ['b@0.2.0', 'c@0.3.0', 'a@0.0.1', 'dep-in-dep@1.0.2']
};

//
// Dependency with an implied runlist
//
trees['single-dep'] = {
  tree: {
    'single-dep@0.1.0': {
      'a@0.0.1': null
    }
  },
  list: ['a@0.0.1', 'single-dep@0.1.0']
};

//
// Dependency with OS specific runlist
//
trees['single-ubuntu-dep'] = {
  tree: {
    'single-ubuntu-dep@0.0.1': {
      'a@0.0.1': null,
      'b@0.2.0': null
    }
  },
  list: ['b@0.2.0', 'a@0.0.1', 'single-ubuntu-dep@0.0.1']
};