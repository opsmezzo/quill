
var assert = require('assert'),
    http = require('http'),
    path = require('path'),
    util = require('util'),
    base64 = require('flatiron').common.base64,
    quill = require('../../lib/quill');

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
