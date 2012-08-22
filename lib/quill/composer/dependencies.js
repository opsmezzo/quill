/*
 * dependencies.js: Common utility functions for analyzing system dependencies.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var common = require('flatiron').common,
    async = common.async,
    semver = require('semver'),
    composer = require('./index'),
    quill = require('../../quill');

//
// ### function dependencies (systems, callback)
// #### @systems {Array|Object} List of systems to create dependency tree for.
// #### @callback {function} Continuation to respond to when complete.
//
// Creates a dependency tree for the specified `systems`.
//
exports.dependencies = function (systems, os, callback) {
  if (!callback && typeof os === 'function') {
    callback = os;
    os = null;
  }
  
  var tree = {};
  
  //
  // Helper function which builds the subtree for 
  // `name` and inserts it into the parent `tree`.
  //
  function updateTree(parts, next) {
    var name = parts[0],
        version = parts[1];
    
    quill.systems.get(name, function (err, system) {
      if (err) {
        return next(err)
      }
      
      version = semver.maxSatisfying(
        Object.keys(system.versions), 
        version || system.version
      );
      
      var tag = name + '@' + version,
          invalid,
          osdeps;
          
      system = system.versions[version];
      invalid = composer.validateSystem(system, os);
      
      if (invalid) {
        return next(invalid);
      }
      
      if (!system.dependencies) {
        tree[tag] = null;
        return next();
      }

      osdeps = osDependencies(system, os);
      composer.dependencies(common.mixin(system.dependencies, osdeps), function (err, subtree) {
        if (err) {
          return next(err);
        }
        
        tree[tag] = subtree;
        next();
      });
    });
  }
  
  async.forEach(exports.systemNames(systems), updateTree, function (err) {
    return err
      ? callback(err)
      : callback(null, tree);
  });
};

//
// ### function runlist (systems, callback)
// #### @systems {Array} List of systems to create runlist for.
// #### @callback {function} Continuation to respond to when complete.
//
// Creates a runlist for the specified `systems`. A runlist is the order
// of operations to follow when installing dependencies for a given system.
// The runlist will always end with the target system. 
//
// 1. Retreive `systems`
// 2. (in-order) `unshift` each system with version onto the list.
//   * If the system exists in the `list` validate the version.
//     * If there is a conflict, respond with error.
// 3. Recursively add the runlist of each dependencies to the list.
//
// Remark: By convention any OS specific runlists run before anything else.
//
exports.runlist = function (systems) {
  var args     = Array.prototype.slice.call(arguments, 1),
      os       = typeof args[0] === 'string' && args.shift(),
      list     = Array.isArray(args[0]) ? args.shift() : [],
      callback = args.shift();
  
  if (!callback && typeof list === 'function') {
    callback = list;
    list = [];
  }
  
  function trimRunlist(record) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === record.name) {
        //
        // TODO: Check semver equality here.
        //
        list.splice(i, 1);
      }
    }
  }
  
  //
  // Helper function which builds the sublist for 
  // `name` and unshifts it into the parent `list`.
  //
  function updateList(parts, next) {
    var name = parts[0],
        pattern = parts[1];
    
    quill.systems.get(name, function (err, system) {
      if (err) {
        return next(err);
      }
      
      var invalid, deps, record = {
        name: name,
        semver: pattern || system.version
      };
      
      record.version = semver.maxSatisfying(
        Object.keys(system.versions), 
        pattern || system.version
      );
      
      if (list.length) {
        //
        // Remark: Could be an error case here if versions mismatch...
        //
        trimRunlist(record);
      }

      list.unshift(record);
      system = system.versions[record.version];

      if (!system.dependencies && !system.runlist) {
        return next();
      }

      invalid = composer.validateSystem(system, os);
      
      if (invalid) {
        return next(invalid);
      }
      
      //
      // Add any OS specific dependencies to the runlist.
      //
      if (os && system.os) {
        deps = osRunlist(system, os);
      }
      
      deps = (deps || []).concat(system.runlist.map(function (name) {
        return system.dependencies[name]
          ? [name, system.dependencies[name]].join('@')
          : null;
      })).reverse().filter(Boolean);
      
      composer.runlist(deps, list, function (err) {
        return err ? next(err) : next();
      });
    });
  }
  
  async.forEachSeries(exports.systemNames(systems), updateList, function (err) {
    if (err) {
      return callback(err);
    }
    
    callback(null, list.map(function (record) {
      return [record.name, record.version].join('@');
    }));
  });
};

//
// ### function systemNames(names)
// #### @names {string|Array|Object} 
//
// Helper function with returns a normalized Array of 
// Arrays representing the `<name, version>` pair
// for the specified `names`.
//
exports.systemNames = function (names) {
  if (typeof names === 'string') {
    return [names.split('@')];
  }
  else if (Array.isArray(names)) {
    return names.map(function (name) {
      return name.split('@');
    });
  }
  
  return Object.keys(names).map(function (name) {
    return [name, names[name]];
  });
}

//
// ### function osRunlist (system, os)
//
// Helper function which returns a runlist for the given 
// `system` and `os`.
//
function osRunlist(system, os) {
  if (!os || typeof system.os !== 'object') {
    return;
  }
  
  //
  // If `system.dependencies` and `system.runlist`
  // are not defined assume that the object is a single dependency
  //
  if (!system.os[os].dependencies && !system.os[os].runlist) {
    return exports.systemNames(system.os[os]).map(function (parts) {
      return parts.join('@');
    });
  }
}

//
// ### function osDependencies (system, os)
//
// Helper function which returns a dependency set for the given 
// `system` and `os`.
//
function osDependencies(system, os) {
  if (!os || typeof system.os !== 'object') {
    return {};
  }
  
  //
  // If `system.dependencies` and `system.runlist`
  // are not defined assume that the object is a single dependency
  //
  if (!system.os[os].dependencies && !system.os[os].runlist) {
    return system.os[os];
  }
  
  return system.os[os].dependencies || {};
}
