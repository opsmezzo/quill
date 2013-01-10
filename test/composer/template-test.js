var assert = require('assert'),
    os = require('os'),
    path = require('path'),
    nock = require('nock'),
    vows = require('vows'),
    helpers = require('../helpers'),
    macros = require('../helpers/macros'),
    mock = require('../helpers/mock'),
    quill = require('../../lib/quill');

var fixturesDir = path.join(__dirname, '..', 'fixtures'),
    installDir = path.join(fixturesDir, 'installed'),
    cacheDir = path.join(fixturesDir, 'cache');

//
// Test macro for asserting that the keys extracted from
// the `template` match the `expected` values.
//
function shouldHaveKeys(template, expected) {
  return function () {
    var keys = quill.composer.template.keys(template.join('\n'));

    keys.forEach(function (key, i) {
      assert.isString(key.text);
      assert.equal(key.key, expected[i].key);
      assert.equal(key.line, expected[i].line);
    });
  }
}

vows.describe('quill/composer/template').addBatch(
  macros.shouldInit(function () {
    quill.config.set('directories:cache', cacheDir);
    quill.config.set('directories:install', installDir);
  })
).addBatch({
  "When using `quill.composer.template`": {
    "the keys() method": shouldHaveKeys(
      [
        '{{ foo }}',
        '{{ bar.0 }}',
        '',
        '{{ baz.nested.x }}',
        '{{ foo.bar }}',
        '{{ foo.bar_baz }}',
        '{{ foo.bar-baz }}',
        '{{ foo.{{ bar }} }}',
        '{{ {{ bar }} }}',
        '{{ foo }} = {{ bar }}'
      ],
      [
        { line: 1, key: 'foo' },
        { line: 2, key: 'bar.0' },
        { line: 4, key: 'baz.nested.x' },
        { line: 5, key: 'foo.bar' },
        { line: 6, key: 'foo.bar_baz' },
        { line: 7, key: 'foo.bar-baz' },
        { line: 8, key: 'foo.{{ bar }}' },
        { line: 9, key: '{{ bar }}' },
        { line: 10, key: 'foo' },
        { line: 10, key: 'bar' }
      ]
    )
  }
}).export(module);
