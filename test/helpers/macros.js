
var assert = require('assert'),
    fs = require('fs'),
    http = require('http'),
    path = require('path'),
    util = require('util'),
    base64 = require('flatiron').common.base64,
    nock = require('nock'),
    helpers = require('./index'),
    mock = require('./mock'),
    quill = require('../../lib/quill'),
    trees = require('../fixtures/systems/trees');

//
// ### function shouldQuillOk
//
// Test macro which executes the quill command for
// the current vows context.
//
exports.shouldQuillOk = function () {
  var args = Array.prototype.slice.call(arguments),
      assertion = "should respond with no error",
      assertFn,
      setupFn,
      mockRequest,
      userPrompts;
      
  args.forEach(function (a) {
    if (typeof a === 'function' && a.name === 'setup') {
      setupFn = a;
    }
    else if (typeof a === 'function') {
      assertFn = a;
    }
    else if (typeof a === 'string') {
      assertion = a;
    }
    else if (a instanceof Array) {
      userPrompts = a;
    }
    else {
      userPrompts = [a];
    }
  });
  
  var context = {
    topic: function () {
      
      var fixturesDir = path.join(__dirname, '..', 'fixtures'),
          that = this,
          argv;
          
      quill.argv._ = this.args = this.context.name.split(' ');
      
      if (!quill.initialized) {
        quill.config.stores.file.file = path.join(fixturesDir, 'dot-quillconf');
        quill.config.stores.file.loadSync();
        
        //
        // Setup mock directories
        //
        quill.options.directories['ssh'] = path.join(fixturesDir, 'keys');
        quill.options.directories['cache'] = path.join(fixturesDir, 'cache');
        quill.options.directories['install'] = path.join(fixturesDir, 'installed');
      }
      
      // Pad the output slightly
      console.log('');
      
      //
      // Execute the target command and assert that no error
      // was returned.
      //
      function startQuill() {
        quill.start(function () {
          // Pad the output slightly
          console.log('');
          that.callback.apply(that, arguments);
        });
      }
      
      //
      // If there is a setup function then call it
      // and start quill
      //
      if (setupFn) {
        if (setupFn.length) {
          return setupFn.apply(this, [startQuill]);
        }
        
        setupFn.call(this);
      }
      
      startQuill();
    }
  };

  context[assertion] = assertFn 
    ? assertFn
    : function (err) { assert.isTrue(!err) };
  
  return context;
};

//
// ### function shouldInit(done)
// 
// Test macro which initializes quill.
//
exports.shouldInit = function (done) {
  return {
    "This test requires quill.init()": {
      topic: function () {
        helpers.init(this.callback);
      },
      "with no error": function (err) {
        assert.isTrue(!err);
        
        if (done) {
          done();
        }
      }
    }
  };
};

//
// ### function shouldFindDeps (args)
//
// Setups mock API endpoints for the `systems`, invokes 
// `quill.composer.dependencies(args)` and asserts the result
// is equal to `tree`.
//
exports.shouldAnalyzeDeps = function (system, os) {
  var api = nock('http://api.testquill.com'),
      fixture = trees[system],
      tree = fixture.tree;
  
  mock.systems.all(api);
    
  return {
    "the dependencies() method": {
      topic: function () {
        quill.composer.dependencies.apply(
          quill.composer,
          [system, os, this.callback].filter(Boolean)
        );
      },
      "should respond with the correct dependency tree": function (err, actual) {
        assert.isNull(err);
        assert.deepEqual(actual, tree);
      },
      "the runlist() method": exports.shouldMakeRunlist(system, os)
    }
  };
};

//
// ### function shouldMakeRunlist (args, os)
//
// Setups mock API endpoints for the `systems`, invokes 
// `quill.composer.runlist(args[, os])` and asserts the result
// is equal to `list`.
//
exports.shouldMakeRunlist = function (system, os) {
  var fixture = trees[system],
      list = fixture.list;

  return {
    topic: function (deps) {
      return quill.composer.runlist({
        systems: deps,
        os: os
      });
    },
    "should respond with the correct runlist": function (actual) {
      assert.deepEqual(
        actual.map(function (system) {
          return [system.name, system.version].join('@');
        }),
        list
      );
    }
  }
};

exports.shouldAnalyzeAllDeps = function () {
  var shouldAnalyzeDeps = exports.shouldAnalyzeDeps;

  return {
    "with a no dependencies":                      shouldAnalyzeDeps('no-deps'),
    "with a single dependency (implicit runlist)": shouldAnalyzeDeps('single-dep'),
    "with a single dependency (empty runlist)":    shouldAnalyzeDeps('empty-runlist'),
    "with multiple dependencies":                  shouldAnalyzeDeps('depends-on-a-b'),
    "with remoteDependencies":                     shouldAnalyzeDeps('hello-remote-deps'),
    "with a dependency in a dependency":           shouldAnalyzeDeps('dep-in-dep'),
    "with a single OS dependency":                 shouldAnalyzeDeps('single-ubuntu-dep', 'ubuntu')
  };
};

exports.shouldAddOne = function (sourceDir, system) {
  var tarball = system.tarball;
  return {
    topic: function () {
      system.tarball = path.join(sourceDir, system.tarball);
      quill.composer.cache.addOne(system, this.callback);
    },
    "should add the system to the cache": function (err, system) {
      assert.isNull(err);
      assert.isObject(system);
      assert.include(system, 'name');
      assert.include(system, 'version');
      assert.include(system, 'root');
      assert.include(system, 'cached');
      assert.include(system, 'tarball');
      
      assert.isObject(fs.statSync(system.root));
      assert.isObject(fs.statSync(system.cached));
      assert.isObject(fs.statSync(system.tarball));
      
      //
      // Move the tarball back
      //
      fs.renameSync(system.tarball, path.join(sourceDir, tarball));
    }
  };
};
