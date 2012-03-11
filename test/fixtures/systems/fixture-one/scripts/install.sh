#!/usr/bin/env node

var fs = require('fs'),
    path = require('path');
        
process.stdout.write(fs.readFileSync(path.join(__dirname, '..', 'files', 'fixture-one.txt'), 'utf8'));