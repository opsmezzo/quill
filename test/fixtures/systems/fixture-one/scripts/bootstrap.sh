#!/usr/bin/env node

var fs = require('fs');
    
console.log(fs.readFileSync('../files/fixture-one.txt', 'utf8'));