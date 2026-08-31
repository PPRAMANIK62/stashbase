'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createRuntimeConfig,
} = require('../../dist/electron/renderer/runtime.cjs');

test('runtime preload exposes only a frozen validated server origin', () => {
  const runtime = createRuntimeConfig([
    '/path/to/electron',
    '--stashbase-server-origin=http://127.0.0.1:43123',
  ]);
  assert.deepEqual(runtime, { serverOrigin: 'http://127.0.0.1:43123' });
  assert.equal(Object.isFrozen(runtime), true);
  assert.throws(() => createRuntimeConfig([
    '--stashbase-server-origin=https://example.com',
  ]));
  assert.throws(() => createRuntimeConfig([]));
});
