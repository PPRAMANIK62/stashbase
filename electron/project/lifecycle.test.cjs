'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PROJECT_LIFECYCLE_CAPABILITY,
  createFolderRemovalCoordinator,
  registerLifecycle,
} = require('../../dist/electron/project/lifecycle.cjs');

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
  const opened = [];
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
    hasCapability: (_window, capability) => capability === PROJECT_LIFECYCLE_CAPABILITY,
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    isLiveWindow: () => true,
    liveWindows: () => windows.map((candidate) => candidate.window),
    openFolderWindow: async (window, folderPath) => {
      opened.push([window, folderPath]);
      return folderPath === '/workspace/missing' ? null : 'opened';
    },
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
  return { eventFor, first, folders, handlers, opened, second };
}

test('folder removal coordinator rejects stale acknowledgements and settles current work', async () => {
  const fixture = windowFixture(17);
  const coordinator = createFolderRemovalCoordinator({
    createRequestId: () => 'request-17',
    timeoutMs: 1_000,
  });
  const readiness = coordinator.request(fixture.window, '/workspace/notes');

  assert.deepEqual(fixture.sent, [[
    'project:folder-removal-requested',
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
  const setActive = setup.handlers.get('project:set-active-folder');
  assert.deepEqual(
    await setActive(setup.eventFor(setup.first), { folderPath: '/workspace/writing' }),
    { ok: true },
  );
  assert.equal(setup.folders.get(setup.first.window), '/workspace/writing');

  const prepare = setup.handlers.get('project:prepare-folder-removal');
  const preparation = prepare(
    setup.eventFor(setup.second),
    { folderPath: '/workspace/notes' },
  );
  await Promise.resolve(); // Folder identity lookup may yield to the filesystem.
  const request = setup.second.sent.at(-1)[1];
  assert.equal(request.folderPath, '/workspace/notes');

  const ready = setup.handlers.get('project:folder-removal-ready');
  assert.deepEqual(
    await ready(setup.eventFor(setup.second), { ...request, ready: true }),
    { ok: true },
  );
  assert.deepEqual(await preparation, { ok: true, ready: true });

  const notify = setup.handlers.get('project:notify-folder-removed');
  assert.deepEqual(
    await notify(setup.eventFor(setup.second), { folderPath: '/workspace/notes' }),
    { ok: true },
  );
  assert.deepEqual(setup.first.sent.at(-1), [
    'project:folder-removed',
    { folderPath: '/workspace/notes' },
  ]);
  assert.deepEqual(setup.second.sent.at(-1), [
    'project:folder-removed',
    { folderPath: '/workspace/notes' },
  ]);
});

test('lifecycle handlers deny untrusted senders before changing window state', async () => {
  const setup = harness();
  setup.first.frame.url = 'https://example.com/';
  const handler = setup.handlers.get('project:set-active-folder');

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

test('opening a member in a window authorizes the sender and answers what main did', async () => {
  const setup = harness();
  const handler = setup.handlers.get('project:open-folder-window');

  assert.deepEqual(
    await handler(setup.eventFor(setup.first), { folderPath: '/workspace/writing' }),
    { action: 'opened', ok: true },
  );
  // The sender crosses so main can exclude it from the match: a window asking
  // for a folder means a second window, not itself.
  assert.deepEqual(setup.opened, [[setup.first.window, '/workspace/writing']]);

  // A folder main could not show is a refusal, not a silent success.
  assert.deepEqual(
    await handler(setup.eventFor(setup.first), { folderPath: '/workspace/missing' }),
    {
      failure: { kind: 'unavailable', message: 'That project could not be opened.' },
      ok: false,
    },
  );
});

test('opening a window refuses an untrusted sender and a malformed request', async () => {
  const setup = harness();
  const handler = setup.handlers.get('project:open-folder-window');

  setup.first.frame.url = 'https://example.com/';
  assert.deepEqual(
    await handler(setup.eventFor(setup.first), { folderPath: '/workspace/writing' }),
    {
      failure: { kind: 'unauthorized', message: 'This window cannot open another window.' },
      ok: false,
    },
  );

  assert.deepEqual(await handler(setup.eventFor(setup.second), { folderPath: '' }), {
    failure: { kind: 'invalid-response', message: 'The folder window request was invalid.' },
    ok: false,
  });
  // Neither reached main.
  assert.deepEqual(setup.opened, []);
});

test('project entry waits for its own renderer acknowledgement and reports close or timeout', async () => {
  const { EventEmitter } = require('node:events');
  const { createProjectEntryCoordinator } = require('../../dist/electron/project/lifecycle.cjs');
  const window = new EventEmitter();
  window.webContents = { id: 91, send() {} };
  window.isDestroyed = () => false;
  const coordinator = createProjectEntryCoordinator(20);
  let complete = false;
  const entering = coordinator.request(window, '/projects/Notes').then(() => { complete = true; });
  const request = coordinator.pending(91);
  assert.equal(complete, false);
  assert.equal(coordinator.finish(92, { ...request, failure: null }), false);
  assert.equal(coordinator.finish(91, { ...request, requestId: '00000000-0000-4000-8000-000000000000', failure: null }), false);
  assert.equal(coordinator.finish(91, { ...request, failure: null }), true);
  await entering;
  assert.equal(coordinator.pending(91), null);
  const cancellation = new AbortController();
  const cancelled = coordinator.request(window, '/projects/Cancelled', cancellation.signal);
  cancellation.abort();
  await assert.rejects(cancelled, /cancelled/);
  const closed = coordinator.request(window, '/projects/Next');
  window.emit('closed');
  await assert.rejects(closed, /closed/);
  await assert.rejects(coordinator.request(window, '/projects/Slow'), /did not become ready/);
  assert.equal(coordinator.finish(91, { ...request, failure: null }), false);
});
