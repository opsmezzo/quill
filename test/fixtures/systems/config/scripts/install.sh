#!/usr/bin/env node
var fs = require('fs');
var env = {};
Object.keys(process.env).forEach(function (key) {
  if (key.match(/^quill_/)) {
    env[key] = process.env[key];
  }
});
process.stdout.write(JSON.stringify({
  env: env,
  file: fs.readFileSync('../files/template-me.txt', 'utf8')
}));
