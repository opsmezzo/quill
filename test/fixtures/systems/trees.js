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
      name: 'no-deps',
      runlist: []
    }
  },
  list: ['no-deps@0.1.2']
};

//
// Dependency tree with remoteDependencies
//
trees['hello-remote-deps'] = {
  tree: {
    'hello-remote-deps': {
      remoteDependencies: { 'fixture-one': '0.0.x' },
      required: '*',
      dependencies: {
        'fixture-two': {
          required: '0.0.x',
          versions: [ '0.0.0' ],
          name: 'fixture-two',
          runlist: []
        }
      },
      versions: [ '0.0.0' ],
      name: 'hello-remote-deps',
      runlist: []
    }
  },
  list: ['fixture-two@0.0.0', 'hello-remote-deps@0.0.0']
};


//
// Dependency tree with two dependencies
//
trees['depends-on-a-b'] = {
  tree: {
    'depends-on-a-b': {
      dependencies: {
        b: {
          name: 'b',
          versions: [ '0.2.0' ],
          required: '0.2.0',
          runlist: []
        },
        a: {
          name: 'a',
          versions: [ '0.0.1' ],
          required: '0.0.1',
          runlist: []
        }
      },
      name: 'depends-on-a-b',
      versions: [ '0.1.2' ],
      required: '*',
      runlist: [ 'b', 'a' ]
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
      name: 'dep-in-dep',
      runlist: [ 'c', 'b', 'a' ],
      dependencies: {
        b: {
          name: 'b',
          runlist: [],
          required: '0.2.0',
          versions: [ '0.2.0' ]
        },
        a: {
          name: 'a',
          runlist: [],
          required: '0.0.1',
          versions: [ '0.0.1' ]
        },
        c: {
          name: 'c',
          runlist: [ 'b' ],
          dependencies: {
            b: {
              name: 'b',
              runlist: [],
              required: '0.2.0',
              versions: [ '0.2.0' ]
            }
          },
          required: '0.3.0',
          versions: [ '0.3.0' ]
        }
      },
      required: '*',
      versions: [ '1.0.2' ]
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
      name: 'single-dep',
      dependencies: {
        a: {
          name: 'a',
          runlist: [],
          required: '0.0.1',
          versions: [ '0.0.1' ]
        }
      },
      runlist: [],
      required: '*',
      versions: [ '0.1.0' ]
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
      required: '*',
      dependencies: {
        a: {
          required: '0.0.1',
          versions: [ '0.0.1' ],
          name: 'a',
          runlist: []
        }
      },
      versions: [ '0.1.0' ],
      name: 'empty-runlist',
      runlist: []
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
      runlist: [],
      versions: [ '0.0.1' ],
      dependencies: {
        a: {
          runlist: [],
          versions: [ '0.0.1' ],
          name: 'a',
          required: '0.0.1'
        },
        b: {
          runlist: [],
          versions: [ '0.2.0' ],
          name: 'b',
          required: '0.2.0'
        }
      },
      name: 'single-ubuntu-dep',
      os: {
        ubuntu: { b: '0.2.0' }
      },
      required: '*'
    }
  },
  list: ['b@0.2.0', 'a@0.0.1', 'single-ubuntu-dep@0.0.1']
};