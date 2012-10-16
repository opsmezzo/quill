#!/usr/bin/env node
var env = {};
Object.keys(process.env).forEach(function (key) {
  if (key.match(/^quill_/)) {
    env[key] = process.env[key];
  }
});
process.stdout.write(JSON.stringify(env));
