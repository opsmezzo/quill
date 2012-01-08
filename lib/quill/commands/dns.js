/*
 * dns.js: Commands for directing apps to different balancers
 *
 * (C) 2011, Nodejitsu Inc.
 *
 */

var eyes = require('eyes'),
    quill = require('../../quill');
    
var dns = exports;

function find(array,func) {
  for (var key in array) {
    if(!!func(array[key], key, array))
      return array[key]
  }
}
var zerigo = require ('../../../vendor/zerigo')

function setupZerigo () {
  var conf = quill.config.get('zerigo')
  var client = zerigo.createClient(conf)
  
  function getZone (name, callback) {
    client.Zone.list(function(err, zones) {
      if (err) 
        return callback (err)
      var zone = find(zones, function (e) { return e.domain === name }  )
      if (!zone) 
        return callback (new Error('could not find zone:' + name))
      callback(null, zone)
    })
  }
  function getHost (name, zone, callback) {
    zone.Host.list(function(err, hosts) {
      if (err)
        return callback (err)
      var host = find(hosts, function (e) { return e.hostname === name }  )
      if (!host) 
        return callback (new Error('could not find host:' + name + 'on zone:' + zone.domain))
      callback(null, host)
    })
  }

  function newSubdomain(zoneID, subdomain, _host, callback) {

    function makeNew (err, zone) {
      if (err) return callback (err)
      zone.Host.getNew(function (err, host) {
        if (err) return callback (err)  
        host.hostname = subdomain
        host.data = _host
        host.ttl = 60 //a lower number that this will not save anything. (does this module pass the error correctly?)
        host.save(callback)    
      })
    }
    if('object' === typeof zoneID) //if the zone is 
      makeNew(null,zoneID)
    else
       zerigo.Zone.get(zoneID, makeNew)
  }

  function add(sub, domain, ip, callback) {

    getZone(domain, function (err,zone) {
      if(err) return callback (err)
      newSubdomain(zone,sub, ip, callback)
    })  
  }

  function rm(sub, domain, callback) {

    getZone(domain, function (err,zone) {
      if(err) return callback (err)
      getHost(sub, zone, function(err,host) {
        if(err) return callback (err)
        host.remove(callback)
      })
    })
  
  }

  function list (callback) {
    getZone(conf.domain, function (err, zone) {
      if(err) return callback (err)
      zone.Host.list(callback)
    })
  }
  return {
    client: client,
    add: add,
    rm: rm,
    list: list,
    getZone: getZone,
    getHost: getHost,
    newSubdomain: newSubdomain
  }
} 


dns.usage = [
  '`quill dns *` commands work with raw and managed server resources',
  '',
  'quill dns list pattern',
  'quill dns add <subdomain> <balancerIP>',
  'quill dns rm <subdomain>',
];

dns.list = function (pattern, callback) {

  var z = setupZerigo()
  var rows = [['hostname', 'host-type', 'data', 'id']],
      colors = ['underline', 'yellow', 'yellow', 'green'],
      regexp;

  if (!callback) {
    callback = pattern;
    pattern = null;
  }
  if (pattern) {
    regexp = new RegExp(pattern, 'i');
  }
 
  quill.log.info('listing dns records for :' + quill.config.get('zerigo:domain'));

  z.list(function (err, list) {
    if(err) return callback(err)
    list.filter(function (i) {
      return i['host-type'] === 'A' && (regexp ? regexp(i.hostname) : true)
    }).forEach(function (i) {
      rows.push([i.hostname, i['host-type'], i.data, i.id])
    })

    quill.inspect.putRows('data', rows, colors);
 
    callback(null, list)
  })
}

dns.list.usage = [
  'list dns A records for the current enviroment\'s domain',
  '',
  'quill dns list <pattern>'
]

dns.add = function (sub, ip, callback) {
  var isIp4 =  /^(\d{1,3}\.){3}\d{1,3}$/
    , isSub = /^[\w-\d]+$/
    
  if(!isSub(sub))
    return callback(new Error('Subdomain:' + sub + ' is not valid. must match:' + isSub))
  if(!isIp4(ip))
    return callback(new Error('ip address:' + ip + ' is not valid. must match:' + isIp4))

  var z = setupZerigo(), 
      conf = quill.config.get('zerigo')
  z.add(sub, conf.domain, ip, function (err, data) {

    if (err) return callback(err)

    quill.log.info('added dns record:' + sub.cyan + '.' + conf.domain.magenta 
      + ' -> '
      + ip.underline)
    quill.inspect.putObject(data);

  }) 
}

dns.add.usage = [
  'add a dns A record to the current enviroment\'s domain',
  '',
  'quill dns add <subdomain> <IPAddress>'
]


dns.rm = function (sub, callback) {
  var isSub = /^[\w-\d]+$/
    
  if(!isSub(sub))
    return callback(new Error('Subdomain:' + sub + ' is not valid. must match:' + isSub))

  var z = setupZerigo(), 
      conf = quill.config.get('zerigo')

  z.rm(sub, conf.domain, function (err, data) {

    if (err) return callback(err)

    quill.log.info('removed dns record:' + sub.cyan + '.' + conf.domain.magenta)
    quill.inspect.putObject(data);
  }) 
}

dns.rm.usage = [
  'remove a dns A record from the current enviroment\'s domain',
  '',
  'quill dns rm <subdomain>',
  '',
  'this will casue traffic for the named sub domain to be handled by the * rule',
  '(which should be pointing to the main balancer)'
]
