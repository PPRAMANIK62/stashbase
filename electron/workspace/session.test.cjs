'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  WORKSPACE_SESSION_CAPABILITY,
  createWorkspaceSessionStore,
  registerWorkspaceSession,
} = require('../../dist/electron/workspace/session.cjs');

const snapshot = {
  activeFolderPath: '/workspace/notes',
  folders: [{
    activeTabId: null,
    expandedPaths: ['drafts'],
    folderPath: '/workspace/notes',
    selectedPath: null,
    tabs: [],
  }],
  shell: { sidebarOpen: true, sidebarWidth: 240 },
  version: 1,
};

function harness(overrides = {}) {
  const handlers = new Map();
  const frame = { url: 'app://renderer/' };
  const sender = { mainFrame: frame };
  const window = {};
  const dependencies = {
    BrowserWindow: { fromWebContents: () => window },
    claimRestore: () => true,
    expectedOrigins: new Set(['app://renderer']),
    hasCapability: (_window, capability) => capability === WORKSPACE_SESSION_CAPABILITY,
    ipcMain: { handle(channel, handler) { handlers.set(channel, handler); } },
    isLiveWindow: () => true,
    store: { read: async () => snapshot, write: async () => undefined },
    ...overrides,
  };
  return { dependencies, event: { sender, senderFrame: frame }, handlers };
}

test('workspace session store round-trips validated state and ignores corrupt versions', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stashbase-session-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'workspace-session.json');
  const store = createWorkspaceSessionStore({ filePath });

  assert.equal(await store.read(), null);
  await store.write(snapshot);
  assert.deepEqual(await store.read(), snapshot);

  await fs.writeFile(filePath, JSON.stringify({ ...snapshot, version: 2 }));
  assert.equal(await store.read(), null);
  await fs.writeFile(filePath, '{broken');
  assert.equal(await store.read(), null);
});

test('workspace session IPC authorizes the sender and validates writes', async () => {
  const writes = [];
  const setup = harness({
    store: { read: async () => snapshot, write: async (value) => writes.push(value) },
  });
  registerWorkspaceSession(setup.dependencies);

  assert.deepEqual(
    await setup.handlers.get('workspace-session:read')(setup.event),
    { ok: true, session: snapshot },
  );
  assert.deepEqual(
    await setup.handlers.get('workspace-session:write')(setup.event, snapshot),
    { ok: true },
  );
  assert.deepEqual(writes, [snapshot]);
  assert.deepEqual(
    await setup.handlers.get('workspace-session:write')(setup.event, {
      ...snapshot,
      pendingCommand: true,
    }),
    {
      ok: false,
      failure: { kind: 'invalid-response', message: 'The workspace session state was invalid.' },
    },
  );
});

test('workspace session IPC denies ungranted windows before storage access', async () => {
  let reads = 0;
  const setup = harness({
    hasCapability: () => false,
    store: { read: async () => { reads += 1; return snapshot; }, write: async () => undefined },
  });
  registerWorkspaceSession(setup.dependencies);

  assert.deepEqual(await setup.handlers.get('workspace-session:read')(setup.event), {
    ok: false,
    failure: {
      kind: 'unauthorized',
      message: 'This window cannot restore workspace session state.',
    },
  });
  assert.equal(reads, 0);
});

test('only the first window claims durable restore while each reload keeps its own snapshot', async () => {
  const firstWindow = {};
  const secondWindow = {};
  const firstFrame = { url: 'app://renderer/' };
  const secondFrame = { url: 'app://renderer/' };
  const firstSender = { mainFrame: firstFrame, window: firstWindow };
  const secondSender = { mainFrame: secondFrame, window: secondWindow };
  let claimed = false;
  const setup = harness({
    BrowserWindow: { fromWebContents: (sender) => sender.window },
    claimRestore: () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
  });
  registerWorkspaceSession(setup.dependencies);
  const read = setup.handlers.get('workspace-session:read');

  assert.deepEqual(await read({ sender: firstSender, senderFrame: firstFrame }), {
    ok: true,
    session: snapshot,
  });
  assert.deepEqual(await read({ sender: secondSender, senderFrame: secondFrame }), {
    ok: true,
    session: null,
  });
  assert.deepEqual(await read({ sender: firstSender, senderFrame: firstFrame }), {
    ok: true,
    session: snapshot,
  });
});
