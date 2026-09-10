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
  const opened = [];
  // What main was created for, one claim each. `second` is a window nobody
  // named a folder for.
  const initialFolders = new Map();
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
    claimInitialFolder: (window) => {
      const folder = initialFolders.get(window) ?? null;
      initialFolders.delete(window);
      return folder;
    },
    expectedOrigins: new Set(['app://renderer']),
    hasCapability: (_window, capability) => capability === LIBRARY_LIFECYCLE_CAPABILITY,
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
  initialFolders.set(first.window, '/workspace/Notes');
  return { eventFor, first, folders, handlers, initialFolders, opened, second };
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

test('opening a member in a window authorizes the sender and answers what main did', async () => {
  const setup = harness();
  const handler = setup.handlers.get('library:open-folder-window');

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
      failure: { kind: 'unavailable', message: 'That folder could not be opened in a window.' },
      ok: false,
    },
  );
});

test('opening a window refuses an untrusted sender and a malformed request', async () => {
  const setup = harness();
  const handler = setup.handlers.get('library:open-folder-window');

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

test('claiming an initial folder answers the creating folder once and none thereafter', async () => {
  const setup = harness();
  const handler = setup.handlers.get('library:claim-initial-folder');

  // The spelling main was created for crosses unchanged; matching main's own
  // lowercased key here would reopen the folder under a rewritten name.
  assert.deepEqual(await handler(setup.eventFor(setup.first)), {
    folderPath: '/workspace/Notes',
    ok: true,
  });

  // Spent. A window that reloads re-reads its folder from the server instead.
  assert.deepEqual(await handler(setup.eventFor(setup.first)), { folderPath: null, ok: true });

  // A window nobody named a folder for answers none, which is a success.
  assert.deepEqual(await handler(setup.eventFor(setup.second)), { folderPath: null, ok: true });
});

test('claiming an initial folder refuses an untrusted sender and an unowned payload', async () => {
  const setup = harness();
  const handler = setup.handlers.get('library:claim-initial-folder');

  setup.first.frame.url = 'https://example.com/';
  assert.deepEqual(await handler(setup.eventFor(setup.first)), {
    failure: { kind: 'unauthorized', message: 'This window cannot claim an initial folder.' },
    ok: false,
  });
  // Refused before the claim was spent, so the real window can still make it.
  assert.equal(setup.initialFolders.get(setup.first.window), '/workspace/Notes');

  // The channel carries nothing: the sender main authorized is the window
  // being answered, so a payload is a caller this build never shipped.
  assert.deepEqual(await handler(setup.eventFor(setup.second), { folderPath: '/etc' }), {
    failure: { kind: 'invalid-response', message: 'The initial folder request was invalid.' },
    ok: false,
  });
});
