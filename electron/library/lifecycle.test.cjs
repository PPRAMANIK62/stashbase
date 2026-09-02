'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  LIBRARY_LIFECYCLE_CAPABILITY,
  createFolderRemovalCoordinator,
  registerLifecycle,
} = require('../../dist/electron/library/lifecycle.cjs');

function windowFixture(id, url = 'app://renderer/') {
  const frame = { url };
  const sent = [];
  const webContents = {
    id,
    mainFrame: frame,
    isDestroyed: () => false,
    send: (channel, payload) => sent.push([channel, payload]),
  };
  return {
    frame,
    sent,
    webContents,
    window: { isDestroyed: () => false, webContents },
  };
}

function harness() {
  const handlers = new Map();
  const first = windowFixture(11);
  const second = windowFixture(12);
  const windows = [first, second];
  const folders = new Map([[first.window, '/workspace/notes'], [second.window, '/workspace/notes']]);
  const dependencies = {
    BrowserWindow: {
      fromWebContents: (webContents) => (
        windows.find((candidate) => candidate.webContents === webContents)?.window ?? null
      ),
    },
    expectedOrigins: new Set(['app://renderer']),
    hasCapability: (_window, capability) => capability === LIBRARY_LIFECYCLE_CAPABILITY,
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    isLiveWindow: () => true,
    liveWindows: () => windows.map((candidate) => candidate.window),
    setActiveFolder: (window, folderPath) => {
      folders.set(window, folderPath);
      return true;
    },
    windowsForFolder: (folderPath) => windows
      .filter((candidate) => folders.get(candidate.window) === folderPath)
      .map((candidate) => candidate.window),
  };
  const eventFor = (fixture) => ({
    sender: fixture.webContents,
    senderFrame: fixture.frame,
  });
  registerLifecycle(dependencies);
  return { eventFor, first, folders, handlers, second };
}

test('folder removal coordinator rejects stale acknowledgements and settles current work', async () => {
  const fixture = windowFixture(17);
  const coordinator = createFolderRemovalCoordinator({
    createRequestId: () => 'request-17',
    timeoutMs: 1_000,
  });
  const readiness = coordinator.request(fixture.window, '/workspace/notes');

  assert.deepEqual(fixture.sent, [[
    'library:folder-removal-requested',
    { folderPath: '/workspace/notes', requestId: 'request-17' },
  ]]);
  assert.equal(coordinator.settle(17, {
    folderPath: '/workspace/notes',
    ready: true,
    requestId: 'stale',
  }), false);
  assert.equal(coordinator.settle(17, {
    folderPath: '/workspace/notes',
    ready: true,
    requestId: 'request-17',
  }), true);
  assert.equal(await readiness, true);
});

test('lifecycle handlers track active folders, await affected windows, and broadcast removal', async () => {
  const setup = harness();
  const setActive = setup.handlers.get('library:set-active-folder');
  assert.deepEqual(
    await setActive(setup.eventFor(setup.first), { folderPath: '/workspace/writing' }),
    { ok: true },
  );
  assert.equal(setup.folders.get(setup.first.window), '/workspace/writing');

  const prepare = setup.handlers.get('library:prepare-folder-removal');
  const preparation = prepare(
    setup.eventFor(setup.second),
    { folderPath: '/workspace/notes' },
  );
  const request = setup.second.sent.at(-1)[1];
  assert.equal(request.folderPath, '/workspace/notes');

  const ready = setup.handlers.get('library:folder-removal-ready');
  assert.deepEqual(
    await ready(setup.eventFor(setup.second), { ...request, ready: true }),
    { ok: true },
  );
  assert.deepEqual(await preparation, { ok: true, ready: true });

  const notify = setup.handlers.get('library:notify-folder-removed');
  assert.deepEqual(
    await notify(setup.eventFor(setup.second), { folderPath: '/workspace/notes' }),
    { ok: true },
  );
  assert.deepEqual(setup.first.sent.at(-1), [
    'library:folder-removed',
    { folderPath: '/workspace/notes' },
  ]);
  assert.deepEqual(setup.second.sent.at(-1), [
    'library:folder-removed',
    { folderPath: '/workspace/notes' },
  ]);
});

test('lifecycle handlers deny untrusted senders before changing window state', async () => {
  const setup = harness();
  setup.first.frame.url = 'https://example.com/';
  const handler = setup.handlers.get('library:set-active-folder');

  assert.deepEqual(
    await handler(setup.eventFor(setup.first), { folderPath: '/workspace/writing' }),
    {
      failure: {
        kind: 'unauthorized',
        message: 'This window cannot update its folder lifecycle.',
      },
      ok: false,
    },
  );
  assert.equal(setup.folders.get(setup.first.window), '/workspace/notes');
});
