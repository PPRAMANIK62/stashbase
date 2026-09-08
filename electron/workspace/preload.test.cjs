'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createWorkspaceSessionPreload,
} = require('../../dist/electron/workspace/preload.cjs');

const snapshot = {
  activeFolderPath: null,
  folders: [],
  shell: { agentPaneWidth: 576, sidebarOpen: false, sidebarWidth: 280 },
  version: 1,
};

test('workspace session preload validates both directions and stays frozen', async () => {
  const calls = [];
  const preload = createWorkspaceSessionPreload({
    async invoke(channel, payload) {
      calls.push([channel, payload]);
      return channel === 'workspace-session:read'
        ? { ok: true, session: snapshot }
        : { ok: true };
    },
  });

  assert.equal(Object.isFrozen(preload), true);
  assert.deepEqual(await preload.read(), { ok: true, session: snapshot });
  assert.deepEqual(await preload.write(snapshot), { ok: true });
  assert.deepEqual(calls, [
    ['workspace-session:read', undefined],
    ['workspace-session:write', snapshot],
  ]);
  await assert.rejects(() => preload.write({ ...snapshot, queryCache: [] }));
});

test('workspace session preload contains thrown and malformed main responses', async () => {
  const unavailable = createWorkspaceSessionPreload({ invoke: async () => { throw new Error('x'); } });
  assert.deepEqual(await unavailable.read(), {
    ok: false,
    failure: { kind: 'unavailable', message: 'Workspace session state is unavailable.' },
  });
  const malformed = createWorkspaceSessionPreload({ invoke: async () => ({ ok: true, future: true }) });
  assert.deepEqual(await malformed.write(snapshot), {
    ok: false,
    failure: { kind: 'unavailable', message: 'Workspace session state is unavailable.' },
  });
});
