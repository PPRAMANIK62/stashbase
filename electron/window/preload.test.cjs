'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createWindowLifecyclePreload } = require('../../dist/electron/window/preload.cjs');

function ipcFixture(reloadResponse = { ok: true, reloaded: true }) {
  const invocations = [];
  const listeners = new Map();
  return {
    invocations,
    emit(channel, payload) {
      listeners.get(channel)?.({}, payload);
    },
    async invoke(channel, payload) {
      invocations.push([channel, payload]);
      return channel === 'window:safe-reload' ? reloadResponse : { ok: true, reloaded: false };
    },
    on(channel, listener) {
      listeners.set(channel, listener);
    },
  };
}

test('window preload flushes every registered barrier and validates reload responses', async () => {
  const ipc = ipcFixture();
  const preload = createWindowLifecyclePreload(ipc);
  const reasons = [];
  const unsubscribe = preload.onPrepareContextRelease(async (reason) => {
    reasons.push(reason);
    return true;
  });

  ipc.emit('window:prepare-context-release', {
    reason: 'window-close',
    requestId: 'close-1',
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(reasons, ['window-close']);
  assert.deepEqual(ipc.invocations.at(-1), [
    'window:context-release-ready',
    { ready: true, reason: 'window-close', requestId: 'close-1' },
  ]);
  assert.deepEqual(await preload.reload(), { ok: true, reloaded: true });

  unsubscribe();
  ipc.emit('window:prepare-context-release', {
    reason: 'window-reload',
    requestId: 'reload-2',
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(ipc.invocations.at(-1), [
    'window:context-release-ready',
    { ready: false, reason: 'window-reload', requestId: 'reload-2' },
  ]);

  const malformed = createWindowLifecyclePreload(ipcFixture({ ok: true, reloaded: 'yes' }));
  assert.deepEqual(await malformed.reload(), { ok: true, reloaded: false });
});

test('window preload carries an update install release across the boundary', async () => {
  const ipc = ipcFixture();
  const preload = createWindowLifecyclePreload(ipc);
  const reasons = [];
  preload.onPrepareContextRelease(async (reason) => {
    reasons.push(reason);
    return true;
  });

  ipc.emit('window:prepare-context-release', {
    reason: 'update-install',
    requestId: 'install-7',
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(reasons, ['update-install']);
  assert.deepEqual(ipc.invocations.at(-1), [
    'window:context-release-ready',
    { ready: true, reason: 'update-install', requestId: 'install-7' },
  ]);
});
