#!/usr/bin/env node

var fs = require('fs');
    
console.log(fs.readFileSync('../files/fixture-two.txt', 'utf8'));