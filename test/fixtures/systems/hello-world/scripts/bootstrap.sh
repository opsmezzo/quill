#!/usr/bin/env node

var fs = require('fs');
    
console.log(fs.readFileSync('../files/hello-world.txt', 'utf8'));