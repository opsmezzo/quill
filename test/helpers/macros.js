
var assert = require('assert'),
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
// ### function shouldInit()
// 
// Test macro which initializes quill.
//
exports.shouldInit = function () {
  return {
    "This test requires quill.init()": {
      topic: function () {
        helpers.init(this.callback);
      },
      "with no error": function (err) {
        assert.isTrue(!err);
      }
    }
  };
};

//
// ### function shouldFindDeps (args, systems, tree)
//
// Setups mock API endpoints for the `systems`, invokes 
// `quill.composer.dependencies(args)` and asserts the result
// is equal to `tree`.
//
exports.shouldFindDeps = function (args) {
  var api = nock('http://api.testquill.com'),
      fixture = trees[args],
      tree = fixture.tree;
  
  mock.systems.all(api);
    
  return {
    topic: function () {
      quill.composer.dependencies(args, this.callback);
    },
    "should respond with the correct dependency tree": function (err, actual) {
      assert.isNull(err);
      assert.deepEqual(actual, tree);
    }
  };
};

//
// ### function shouldFindDeps (args, systems, tree)
//
// Setups mock API endpoints for the `systems`, invokes 
// `quill.composer.dependencies(args)` and asserts the result
// is equal to `list`.
//
exports.shouldMakeRunlist = function (args) {
  var api = nock('http://api.testquill.com'),
      fixture = trees[args],
      list = fixture.list;
      
  mock.systems.all(api);
    
  return {
    topic: function () {
      quill.composer.runlist(args, this.callback);
    },
    "should respond with the correct runlist": function (err, actual) {
      assert.isNull(err);
      assert.deepEqual(actual, list);
    }
  }
}