
var path = require('path'),
    flatiron = require('flatiron');

var quill = module.exports = new flatiron.App({
  root: path.join(__dirname, '..'),
  directories: {
    config: "#ROOT/config"
  }
})