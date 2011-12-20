
var path = require('path'),
    flatiron = require('flatiron');

var quill = module.exports = new flatiron.App({
  root: path.join(__dirname, '..'),
  directories: {
    config: path.join(process.env.HOME, '.quill'),
    env: path.join(process.env.HOME, '.quill', 'env'),
    keys: path.join(process.env.HOME, '.quill', 'keys')
  }
});

quill.inspect = require('cliff');