'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createExternalNavigationPreload,
} = require('../../dist/electron/external-navigation/preload.cjs');

test('external navigation preload validates both directions and is frozen', async () => {
  const invocations = [];
  const preload = createExternalNavigationPreload({
    invoke: async (channel, payload) => {
      invocations.push([channel, payload]);
      return { ok: true };
    },
  });

  assert.equal(Object.isFrozen(preload), true);
  assert.deepEqual(await preload.open('https://example.com/docs'), { ok: true });
  assert.deepEqual(invocations, [
    ['external-navigation:open', { url: 'https://example.com/docs' }],
  ]);
  await assert.rejects(() => preload.open('javascript:alert(1)'));

  const malformed = createExternalNavigationPreload({ invoke: async () => ({ ok: 'yes' }) });
  assert.equal((await malformed.open('https://example.com')).ok, false);
});
