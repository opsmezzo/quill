# quill

**Flawless configuration of your cloud infrastructure:** `quill` is a configuration tool with a focus on automation and infrastructure opacity.

![](/assets/quill.png)

## Usage

* [Conventions](#conventions)
* [Installation](#installation)
* [Running Locally](#running-locally)
* [Tests](#tests)

## Conventions
`quill` is a robust and fully-featured configuration toolset with a simple convention for executing commands:

``` bash
  $ quill <resource> <command>
```

for example: 

``` bash
  $ quill systems list
```

will list all `system` Resources in your current registry. The tool itself is designed to be self documenting via the `quill help` command. For example to learn what the `systems list` command does:

``` bash
  $ quill help systems list
  info:   Welcome to quill
  info:   It worked if it ends with quill ok
  info:   Executing command help systems list
  help:   Lists all systems in the registry.
  help:   
  help:   quill list
  help:   quill systems list
  quill ok
```

## Installation

``` bash
  $ [sudo] npm install quill-cli -g --registry http://reg.njitsu.net:5984/ --user-config YOUR-PRIVATE-NPM-CONFIG
```

## Running locally

For testing purposes it is possible to run `quill` locally if you have `conservatory` running locally with sample data:

* _Start conservatory locally with sample data_
```
  $ cd /path/to/conservatory
  $ bin/seed
  $ bin/composer
```

* _Login to baton with the sample user: devjitsu / 1234_
```
  $ cd /path/to/quill
  $ quill config set remoteHost localhost
  $ quill config set port 9003
  $ quill login
  info:    Welcome to quill
  info:    It worked if it ends with quill ok
  info:    Executing command login
  prompt: username: devjitsu 
  prompt: password: 1234 
  info:    Authenticated as devjitsu
  info:    quill ok
```


## Tests

All tests are written with [vows][0] and intended to be run with [npm][1]:

``` bash
  $ npm test
```

#### Author: [Nodejitsu Inc][2]
#### Contributors: [Charlie Robbins](http://github.com/indexzero)

[0]: http://vowsjs.org
[1]: http://npmjs.org
[2]: http://nodejitsu.com