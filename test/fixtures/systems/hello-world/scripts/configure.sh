#!/usr/bin/env node

var fs = require('fs'),
    path = require('path');
    
process.stdout.write(fs.readFileSync(path.join(__dirname, '..', 'files', 'hello-world.txt'), 'utf8'));