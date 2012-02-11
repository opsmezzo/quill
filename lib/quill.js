
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

//
// Setup `jitsu` to use `pkginfo` to expose version
//
require('pkginfo')(module, 'name', 'version');

//
// Configure quill to use `flatiron.plugins.cli`
//
quill.use(flatiron.plugins.cli, {
  usage: require('./quill/usage'),
  source: path.join(__dirname, 'quill', 'commands'),
  argv: {
    version: {
      alias: 'v',
      description: 'print quill version and exit',
      string: true
    },
    localconf: {
      description: 'search for .quillconf file in ./ and then parent directories',
      string: true
    },
    quillconf: {
      alias: 'b', 
      description: 'specify file to load configuration from',
      string: true
    }
  }
});

//
// Setup config, command aliases and prompt settings
//
require('./quill/config');
require('./quill/alias')