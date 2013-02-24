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
  tree: {
    'no-deps': {
      versions: [ '0.1.2' ],
      required: '*',
      name: 'no-deps'
    }
  },
  list: ['no-deps@0.1.2']
};

//
// Dependency tree with two dependencies
//
trees['depends-on-a-b'] = {
  tree: {
    'depends-on-a-b': {
      b: {
        name: 'b',
        required: '0.2.0',
        versions: [ '0.2.0' ]
      },
      a: {
        name: 'a',
        required: '0.0.1',
        versions: [ '0.0.1' ]
      }
    }
  },
  list: ['b@0.2.0', 'a@0.0.1', 'depends-on-a-b@0.1.2']
};

//
// Dependency tree with dependency in a dependency
//
trees['dep-in-dep'] = {
  tree: {
    'dep-in-dep': {
      b: {
        required: '0.2.0',
        versions: [ '0.2.0' ],
        name: 'b'
      },
      a: {
        required: '0.0.1',
        versions: [ '0.0.1' ],
        name: 'a'
      },
      c: {
        b: {
          required: '0.2.0',
          versions: [ '0.2.0' ],
          name: 'b'
        }
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
    'single-dep': {
      a: {
        required: '0.0.1',
        name: 'a',
        versions: [ '0.0.1' ]
      }
    }
  },
  list: ['a@0.0.1', 'single-dep@0.1.0']
};

//
// Dependency with an implied runlist but
// that runlist is empty.
//
trees['empty-runlist'] = {
  tree: {
    'empty-runlist': {
      a: {
        required: '0.0.1',
        name: 'a',
        versions: [ '0.0.1' ]
      }
    }
  },
  list: ['a@0.0.1', 'empty-runlist@0.1.0']
};


//
// Dependency with OS specific runlist
//
trees['single-ubuntu-dep'] = {
  tree: {
    'single-ubuntu-dep': {
      b: {
        required: '0.2.0',
        versions: [ '0.2.0' ],
        name: 'b'
      },
      a: {
        required: '0.0.1',
        versions: [ '0.0.1' ],
        name: 'a'
      }
    }
  },
  list: ['b@0.2.0', 'a@0.0.1', 'single-ubuntu-dep@0.0.1']
};