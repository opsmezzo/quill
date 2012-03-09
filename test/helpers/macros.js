
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
      
      var that = this,
          argv;
          
      quill.argv._ = this.context.name.split(' ')
      quill.config.stores.file.file = path.join(__dirname, '..', 'fixtures', 'dot-quillconf');
      quill.config.stores.file.loadSync();

      // Pad the output slightly
      console.log('');
      
      //
      // If there is a setup function then call it
      //
      if (setupFn) {
        setupFn();
      }
      
      //
      // Execute the target command and assert that no error
      // was returned.
      //
      quill.start(function () {
        // Pad the output slightly
        console.log('');
        that.callback.apply(that, arguments);
      });
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
exports.shouldFindDeps = function (args, os) {
  var api = nock('http://api.testquill.com'),
      fixture = trees[args],
      tree = fixture.tree;
  
  mock.systems.all(api);
    
  return {
    topic: function () {
      quill.composer.dependencies.apply(
        quill.composer,
        [args, os, this.callback].filter(Boolean)
      );
    },
    "should respond with the correct dependency tree": function (err, actual) {
      assert.isNull(err);
      assert.deepEqual(actual, tree);
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
exports.shouldMakeRunlist = function (args, os) {
  var api = nock('http://api.testquill.com'),
      fixture = trees[args],
      list = fixture.list;
      
  mock.systems.all(api);
    
  return {
    topic: function () {
      quill.composer.runlist.apply(
        quill.composer,
        [args, os, this.callback].filter(Boolean)
      );
    },
    "should respond with the correct runlist": function (err, actual) {
      assert.isNull(err);
      assert.deepEqual(actual, list);
    }
  }
};

exports.shouldAnalyzeDeps = function (fn) {
  return {
    "with a no dependencies": fn('no-deps'),
    "with a single dependency (implicit runlist)": fn('single-dep'),
    "with multiple dependencies": fn('depends-on-a-b'),
    "with a dependency in a dependency": fn('dep-in-dep'),
    "with a single OS dependency": fn('single-ubuntu-dep', 'ubuntu')
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
      assert.include(system, 'path');
      assert.include(system, 'tarball');
      
      assert.isObject(fs.statSync(system.root));
      assert.isObject(fs.statSync(system.path));
      assert.isObject(fs.statSync(system.tarball));
      
      //
      // Move the tarball back
      //
      fs.renameSync(system.tarball, path.join(sourceDir, tarball));
    }
  };
};