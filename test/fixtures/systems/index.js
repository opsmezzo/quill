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
  }
];