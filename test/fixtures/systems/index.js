/*
 * systems.js: Test fixtures for all systems in dependency trees.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */
 
var systems = module.exports = [
  {
    name: 'no-deps',
    version: '0.1.2',
    versions: {
      '0.1.2': {}
    }
  }, 
  {
    name: 'single-dep',
    version: '0.1.0',
    versions: {
      '0.1.0': {
        dependencies: {
          a: '0.0.1'
        }
      }
    }
  },
  {
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
  },
  {
    name: 'dep-in-dep',
    version: '1.0.2',
    versions: {
      '1.0.2': {
        runlist: ['c', 'b', 'a'],
        dependencies: {
          a: '0.0.1',
          b: '0.2.0',
          c: '0.3.0'
        }
      }
    }
  },
  {
    name: 'single-ubuntu-dep',
    version: '0.0.1',
    versions: {
      '0.0.1': {
        dependencies: {
          'a': '0.0.1'
        }
      }
    },
    os: {
      ubuntu: { 'b': '0.2.0' }
    }
  },
  {
    name: 'a',
    version: '0.0.1',
    versions: {
      '0.0.1': {}
    }
  }, 
  {
    name: 'b',
    version: '0.2.0',
    versions: {
      '0.2.0': {}
    }
  },
  {
    name: 'c',
    version: '0.3.0',
    versions: {
      '0.3.0': {
        runlist: ['b'],
        dependencies: {
          b: '0.2.0'
        }
      }
    }
  }
];

//
// Fill duplicate properties in `versions` of all systems.
//
systems.forEach(function (system) {
  if (!system.versions) {
    return;
  }
  
  function hoistValue(version, prop) {
    system.versions[version][prop] = system.versions[version][prop]
      || system[prop];
  }
  
  Object.keys(system.versions).forEach(function (version) {
    //
    // TODO: Hoist all the things!
    //
    hoistValue(version, 'name');
    hoistValue(version, 'os');
  });
});