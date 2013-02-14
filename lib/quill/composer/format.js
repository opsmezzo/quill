/*
 * format.js: Utility functions for formatting composer information
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

//
// ### function hierarchy (label, systems)
// #### @label {string} Label for the hierarchy
// #### @systems {Object} System dependencies for the `label`. 
// Returns a fully realized hierarchy of all systems.
//
exports.hierarchy = function (label, systems) {
  systems = systems.dependencies || systems;
  
  return {
    label: label,
    nodes: Object.keys(systems).map(function (name) {
      if (typeof systems[name] === 'string') {
        return [name, systems[name]].join('@');
      }
      else if (systems[name].dependencies) {
        return exports.hierarchy(
          [name, systems[name].version].join('@'),
          systems[name]
        );
      }
      else if (systems[name].version) {
        return [name, systems[name].version].join('@');
      }
    }).filter(Boolean)
  };
};