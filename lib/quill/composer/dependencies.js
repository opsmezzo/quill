/*
 * dependencies.js: Common utility functions for analyzing system dependencies.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var path = require('path'),
    common = require('flatiron').common,
    async = common.async,
    semver = require('semver'),
    wtfos = require('wtfos'),
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
    var name    = parts[0],
        version = parts[1];
    
    quill.systems.get(name, function (err, system) {
      if (err) {
        return next(err)
      }

      var versions = Object.keys(system.versions),
          required = version || "*",
          invalid,
          osdeps;

      version = semver.maxSatisfying(
        Object.keys(system.versions), 
        version || system.version
      );
      
      system  = system.versions[version];
      system.versions = versions;
      system.required = required;
      invalid = composer.validateSystem(system, os);
      
      if (invalid) {
        return next(invalid);
      }
      
      if (!system.dependencies) {
        tree[name] = system;
        return next();
      }

      osdeps = osDependencies(system, os);
      composer.dependencies(common.mixin(system.dependencies, osdeps), function (err, subtree) {
        if (err) {
          return next(err);
        }
        
        tree[name] = subtree;
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
// ### function runlist (options, callback)
// #### @options {Object} Options for calculating the runlist.
// ####   @options.os       {string} OS for the runlist.
// ####   @options.list     {Array}  Current runlist found.
// ####   @options.depth    {number} Depth in the current runlist.
// ####   @options.maxDepth {number} Max depth of the runlist.
// ####   @options.systems  {object} Systems to add to the runlist.
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
exports.runlist = function (options, callback) {
  var os       = options.os,
      list     = options.list  || [],
      depth    = options.depth || 0,
      maxDepth = options.maxDepth,
      systems  = options.systems;
  
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
    var name    = parts[0],
        pattern = parts[1];
    
    quill.systems.get(name, function (err, system) {
      if (err) {
        if (err.result && err.result.status === 404) {
          err.status = 404;
          err.result.error = [name, err.result.error].join(' ');
        }

        return next(err);
      }
      
      var required = pattern || system.version,
          invalid,
          deps;

      var record = {
        name: name,
        semver: required,
        scripts: system.scripts,
        config: system.config
      };
      
      record.version = semver.maxSatisfying(
        Object.keys(system.versions), 
        required
      );
      
      if (list.length) {
        //
        // Remark: Could be an error case here if versions mismatch...
        //
        trimRunlist(record);
      }

      list.unshift(record);
      system = system.versions[record.version];

      if (!system) {
        return next(new Error('Could not resolve dependency: ' + name + '@' + required));
      }

      if (!system.dependencies && !system.runlist && !system.os) {
        return next();
      }

      if ((!system.runlist || !system.runlist.length) && system.dependencies) {
        system.runlist = Object.keys(system.dependencies);
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
      
      deps = (deps || []).concat((system.runlist || []).map(function (name) {
        return system.dependencies[name]
          ? [name, system.dependencies[name]].join('@')
          : null;
      })).reverse().filter(Boolean);
      
      composer.runlist({
        os: os,
        list: list,
        systems: deps,
        depth: depth++,
        maxDepth: maxDepth
      }, function (err) {
        return err ? next(err) : next();
      });
    });
  }
  
  //
  // If we've exceeded the maximum depth then
  // respond immediately.
  //
  if (maxDepth && depth > maxDepth) {
    return callback(null, list);
  }

  async.forEachSeries(exports.systemNames(systems), updateList, function (err) {
    return err
      ? callback(err)
      : callback(null, list);
  });
};

//
// ### function latestSatisfying (callback)
// #### @callback {function} Continuation to respond to
// Returns an object containing the latest versions which
// satisfy the dependency needs the system installed
// with the given name
//
// Algorithm:
//   1. Get the current OS with wtfos
//   2. Build the dependency tree for those systems and
//      the current OS
//   3. Reduce the dependency tree to the aggregate semver
//      satisfying string, the "required satisfying set".
//   4. Get latest for all installed systems
//   5. Reduce latest against the satisfying set.
//
exports.maxSatisfying = function (system, callback) {
  async.waterfall([
    //
    // 1. Get the current OS with wtfos
    //
    async.apply(wtfos),
    //
    // 3. Build the dependency tree for those systems and
    //    the current OS
    // 4. Reduce the dependency tree to the aggregate semver
    //    satisfying string, the "satisfying set".
    //
    function satisfyingSet(os, next) {
      var name = system.name || system,
          systems = {};

      systems[name] = system.version || '*';

      //
      // Recursively adds all dependencies in the
      // system dependency subtree to the satisfying set.
      //
      function addSatisfying(deps, set) {
        return Object.keys(deps).reduce(function (all, name) {
          all[name] =  all[name] ? (all[name] + ' ') : '';
          all[name] += deps[name].required;

          if (deps[name].dependencies) {
            all = addSatisfying(deps[name], all);
          }

          return all;
        }, set);
      }

      exports.dependencies(systems, os, function (err, deps) {
        if (err) {
          return next(err);
        }

        next(null, Object.keys(deps).reduce(function (set, name) {
          return addSatisfying(deps[name], set);
        }, {}));
      });
    },
    //
    // 5. Get latest for all installed systems
    //
    function getLatest(set, done) {
      async.reduce(
        Object.keys(set),
        {},
        function getSystem(latest, name, next) {
          quill.systems.get(name, function (err, system) {
            if (err) {
              return next(err);
            }

            latest[name] = system;
            next(null, latest);
          });
        },
        function (err, latest) {
          return !err
            ? done(null, latest, set)
            : done(err);
        }
      );
    }
  ], function satisfy(err, latest, required) {
    if (err) {
      return callback(err);
    }

    callback(null, Object.keys(required)
      .reduce(function (sat, name) {
        sat[name] = semver.maxSatisfying(
          Object.keys(latest[name].versions),
          required[name]
        );
        return sat;
      }, {}));
  });
};

//
// ### function localizeRunlist (options)
// #### @runlist {Array} List of systems to create runlist for.
// #### @callback {function} Continuation to respond to when complete.
//
// Localizes the specified `runlist` removing any systems already installed.
//
exports.localizeRunlist = function (runlist, installed) {
  if (!installed) {
    return runlist;
  }

  //
  // Reduce the list for anything already installed
  //
  return runlist.map(function (system) {
    if (installed[system.name] && installed[system.name].system) {
      quill.log.info('Already installed: ' + system.name.magenta);
    }

    return !installed[system.name] || !installed[system.name].system
      ? system
      : null;
  }).filter(Boolean);
};

//
// ### function filterRunlist (runlist, script, callback)
// #### @action {string} Action being run on the filtered runlist.
// #### @runlist {Array} List of systems to create runlist for.
// #### @installed {Object} Information about installed systems.
//
// Filter scripts for all systems in the `runlist` to exclude:
// 1. Any scripts which are extraneous for the `action`
// 2. Any non-recursive actions (i.e. update and uninstall)
//    (unless --r | --recursive is set).
// 3. That have already been run based on the local history
//    (unless --force is set)
//
exports.filterRunlist = function (action, runlist, installed) {
  //
  // Regify a given string
  //
  function regify(str) {
    return new RegExp('^' + str, 'i');
  }

  //
  // Filter scripts against a given set of RegExps
  // (i.e. predicate list).
  //
  function filterScripts(list, iter) {
    return function (system) {
      if (Array.isArray(system.scripts)) {
        system.scripts = system.scripts.filter(function (script) {
          var isValid = list.some(function (re) {
            return re.test(script);
          });

          if (iter) {
            iter(isValid, system, script);
          }
          return isValid;
        });
      }

      return system;
    }
  }

  var previous = composer.orderings[action] || [],
      matchers = [regify(action)],
      recursiveActions,
      parent;

  //
  // Create predicate lists for lifecycle actions for which
  // this `action` is dependent and for those that are
  // `recursiveActions` (e.g. install, configure).
  //
  previous = previous.map(regify);
  matchers = matchers.concat(previous);
  recursiveActions = Object.keys(composer.actions)
    .filter(function (name) {
      return composer.actions[name].recursive;
    }).map(regify);

  //
  // 1. Filter the set of scripts for the system to only include
  // those required by the specified `action`.
  //
  runlist = runlist.map(filterScripts(matchers));

  //
  // 2. Filter out any non-recursive actions
  //
  if (!quill.argv.r && !quill.argv.recursive) {
    parent = runlist.pop();
    runlist = runlist.map(
      filterScripts(recursiveActions, function (isValid, system, script) {
        if (!isValid) {
          quill.log.warn([
            'Skipping non-recursive lifecycle action',
            script,
            'for',
            system.name
          ].join(' '));
        }
      })
    ).concat(parent);
  }

  //
  // 3. Reduce the list of scripts for anything already installed
  // based on the history on the local machine.
  //
  if (installed) {
    runlist = runlist.map(function (system) {
      if (!installed[system.name] || !installed[system.name].system) {
        return system;
      }

      var history = installed[system.name].history || {},
          uninstalled,
          actions;

      actions = Object.keys(history).reduce(function (all, key) {
        return history[key].time === 'end'
          ? all.concat(history[key].action)
          : all;
      }, []);

      uninstalled = actions.indexOf('uninstall');
      if (uninstalled !== -1) {
        actions = actions.slice(uninstalled + 1);
      }

      //
      // If there is no history, return all the scripts
      // for the system.
      //
      if (!actions.length) {
        return system;
      }

      function logSkip(script) {
        quill.log.info([
          'Already executed lifecycle action',
          script.yellow,
          'for',
          system.name.magenta
        ].join(' '));
      }

      //
      // Remove the install script since this system is already
      // installed
      //
      logSkip('install');
      system.scripts = system.scripts.filter(function (script) {
        return !/^install/.test(script);
      });

      //
      // Now filter out any dependent scripts for the action
      // e.g. for `start`, remove `configure` and `install`.
      //
      system.scripts = system.scripts.filter(function (script) {
        var alreadyRun = previous.some(function (re) {
          return re.test(script);
        });

        if (alreadyRun) {
          logSkip(script);
        }

        return !alreadyRun;
      });

      return system;
    });
  }

  parent = runlist.pop();
  //
  // If there are no scripts in `system.scripts` then skip this
  // system.
  //
  if (!Array.isArray(parent.scripts) || !parent.scripts.length) {
    quill.log.warn('No scripts found for: ' + parent.name.magenta + ' ' + action);
  }

  runlist.push(parent);
  return runlist;
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
    return [name, names[name] || '*'];
  });
}

//
// ### function osRunlist (system, os)
//
// Helper function which returns a runlist for the given 
// `system` and `os`.
//
function osRunlist(system, os) {
  if (!os || typeof system.os !== 'object' || typeof system.os[os] !== 'object') {
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
