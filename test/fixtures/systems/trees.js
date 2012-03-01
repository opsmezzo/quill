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
  systems: [{
    name: 'no-deps',
    version: '0.1.2',
    versions: {
      '0.1.2': {}
    }
  }],
  tree: { 'no-deps@0.1.2': null },
  list: ['no-deps@0.1.2']
};

//
// Dependency tree with two dependencies
//
trees['depends-on-a-b'] = {
  systems: [{
    name: 'depends-on-a-b',
    version: '0.1.2',
    versions: {
      '0.1.2': {
        runlist: ['b', 'a'],
        dependencies: {
          a: '0.0.1',
          b: '0.2.0'
        }
      }
    }
  }, {
    name: 'a',
    version: '0.0.1',
    versions: {
      '0.0.1': {}
    }
  }, {
    name: 'b',
    version: '0.2.0',
    versions: {
      '0.2.0': {}
    }
  }],
  tree: { 
    'depends-on-a-b@0.1.2': {
      'a@0.0.1': null,
      'b@0.2.0': null
    }
  },
  list: ['b@0.2.0', 'a@0.0.1', 'depends-on-a-b@0.1.2']
};