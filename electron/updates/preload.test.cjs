'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createUpdatesPreload } = require('../../dist/electron/updates/preload.cjs');

function createIpc(response) {
  const invocations = [];
  const listeners = new Map();
  return {
    invocations,
    emit(channel, payload) {
      listeners.get(channel)?.({}, payload);
    },
    async invoke(channel, payload) {
      invocations.push([channel, payload]);
      if (response instanceof Error) throw response;
      return response;
    },
    on(channel, listener) {
      listeners.set(channel, listener);
    },
  };
}

const snapshot = { autoCheckEnabled: true, currentVersion: '1.4.2', phase: 'idle' };
const answer = { ok: true, snapshot };
const failed = { ok: false, failure: { kind: 'failed' } };
const invalidRequest = { ok: false, failure: { kind: 'invalid-request' } };

test('the updates bridge is frozen and exposes one key per capability', () => {
  const api = createUpdatesPreload(createIpc(answer));
  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(Object.keys(api).sort(), [
    'check',
    'onSnapshot',
    'openReleasePage',
    'primaryAction',
    'read',
    'setAutoCheck',
    'setSimulation',
  ]);
});

test('every method invokes its own channel with the validated request', async () => {
  const ipc = createIpc(answer);
  const api = createUpdatesPreload(ipc);

  assert.deepEqual(await api.read(), answer);
  assert.deepEqual(await api.check(), answer);
  assert.deepEqual(await api.primaryAction(), answer);
  assert.deepEqual(await api.openReleasePage(), answer);
  assert.deepEqual(await api.setAutoCheck(true), answer);
  assert.deepEqual(await api.setSimulation('downloading'), answer);

  assert.deepEqual(ipc.invocations, [
    ['updates:read', undefined],
    ['updates:check', undefined],
    ['updates:primary-action', undefined],
    ['updates:open-release-page', undefined],
    ['updates:set-auto-check', { enabled: true }],
    ['updates:set-simulation', { value: 'downloading' }],
  ]);
});

test('pushed snapshots are validated and the subscription is the caller to end', () => {
  const ipc = createIpc(answer);
  const api = createUpdatesPreload(ipc);
  const seen = [];
  const unsubscribe = api.onSnapshot((pushed) => seen.push(pushed));

  ipc.emit('updates:snapshot', { ...snapshot, message: 'never shown' });
  ipc.emit('updates:snapshot', { ...snapshot, percent: 40 });
  ipc.emit('updates:snapshot', { autoCheckEnabled: true, phase: 'available' });
  ipc.emit('updates:snapshot', { autoCheckEnabled: true, currentVersion: '1.4.2', phase: 'nowhere' });
  ipc.emit('updates:snapshot', snapshot);
  assert.deepEqual(seen, [snapshot]);

  unsubscribe();
  ipc.emit('updates:snapshot', snapshot);
  assert.equal(seen.length, 1, 'an ended subscription receives nothing further');
});

test('a rejected invocation reads as a failure, which is how a packaged build refuses', async () => {
  const rejecting = createUpdatesPreload(createIpc(new Error('No handler registered')));
  assert.deepEqual(await rejecting.setSimulation('ready'), failed);
  assert.deepEqual(await rejecting.read(), failed);
  assert.deepEqual(await rejecting.check(), failed);
  assert.deepEqual(await rejecting.primaryAction(), failed);
  assert.deepEqual(await rejecting.openReleasePage(), failed);
  assert.deepEqual(await rejecting.setAutoCheck(false), failed);
});

test('an answer that is not a recognized result reads as a failure', async () => {
  for (const response of [
    undefined,
    null,
    true,
    'ok',
    {},
    { ok: true },
    { ok: false },
    { ok: true, snapshot: { phase: 'idle' } },
    { ok: true, snapshot: { ...snapshot, message: 'never shown' } },
    { ok: false, failure: { kind: 'nope' } },
    { ok: true, snapshot, extra: true },
  ]) {
    assert.deepEqual(
      await createUpdatesPreload(createIpc(response)).check(),
      failed,
      `${JSON.stringify(response) ?? String(response)} must not be trusted`,
    );
  }
});

test('a bad argument is refused without reaching main', async () => {
  const ipc = createIpc(answer);
  const api = createUpdatesPreload(ipc);

  assert.deepEqual(await api.setAutoCheck('yes'), invalidRequest);
  assert.deepEqual(await api.setAutoCheck(undefined), invalidRequest);
  assert.deepEqual(await api.setAutoCheck(1), invalidRequest);
  assert.deepEqual(await api.setSimulation('nowhere'), invalidRequest);
  assert.deepEqual(await api.setSimulation(undefined), invalidRequest);
  assert.deepEqual(await api.setSimulation({ value: 'ready' }), invalidRequest);

  assert.deepEqual(ipc.invocations, []);
});
