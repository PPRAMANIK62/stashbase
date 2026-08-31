'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  WORKSPACE_FOLDER_DIALOG_CAPABILITY,
  authorizeWorkspaceFolderDialogSender,
  registerWorkspaceFolderDialogIpc,
} = require('../dist/electron/workspace-folder-dialog-ipc.cjs');

function harness(overrides = {}) {
  const handlers = new Map();
  const frame = { url: 'app://renderer/' };
  const sender = { mainFrame: frame };
  const window = { name: 'main-window' };
  const dialogCalls = [];
  const dependencies = {
    BrowserWindow: { fromWebContents: () => window },
    dialog: {
      async showOpenDialog(...args) {
        dialogCalls.push(args);
        return { canceled: false, filePaths: ['/workspace/notes'] };
      },
    },
    ipcMain: { handle(channel, handler) { handlers.set(channel, handler); } },
    expectedOrigins: new Set(['app://renderer']),
    isLiveWindow: () => true,
    hasCapability: (_window, capability) => capability === WORKSPACE_FOLDER_DIALOG_CAPABILITY,
    ...overrides,
  };
  const event = { sender, senderFrame: frame };
  return { dependencies, dialogCalls, event, handlers, window };
}

test('folder-dialog authorization binds live main frame, origin, and capability', () => {
  const setup = harness();
  assert.equal(
    authorizeWorkspaceFolderDialogSender(setup.event, setup.dependencies),
    setup.window,
  );

  assert.equal(
    authorizeWorkspaceFolderDialogSender(
      { ...setup.event, senderFrame: { url: 'app://renderer/frame' } },
      setup.dependencies,
    ),
    null,
  );
  setup.event.senderFrame.url = 'https://example.com/';
  assert.equal(authorizeWorkspaceFolderDialogSender(setup.event, setup.dependencies), null);
  setup.event.senderFrame.url = 'app://renderer/';
  assert.equal(
    authorizeWorkspaceFolderDialogSender(
      setup.event,
      { ...setup.dependencies, hasCapability: () => false },
    ),
    null,
  );
});

test('authorized folder-dialog handler validates payload and returns producer-validated success', async () => {
  const setup = harness();
  registerWorkspaceFolderDialogIpc(setup.dependencies);
  const handler = setup.handlers.get('workspace:choose-folder');

  assert.deepEqual(
    await handler(setup.event, { allowCreateDirectory: false, defaultPath: '/workspace' }),
    { ok: true, folderPath: '/workspace/notes' },
  );
  assert.deepEqual(setup.dialogCalls, [[setup.window, {
    title: 'Choose a folder',
    properties: ['openDirectory'],
    defaultPath: '/workspace',
  }]]);

  assert.deepEqual(await handler(setup.event, { title: 'Unowned title' }), {
    ok: false,
    failure: { kind: 'invalid-response', message: 'The folder request was invalid.' },
  });
  assert.equal(setup.dialogCalls.length, 1);
});

test('folder-dialog handler denies unauthorized senders before invoking native UI', async () => {
  const setup = harness({ isLiveWindow: () => false });
  registerWorkspaceFolderDialogIpc(setup.dependencies);
  const result = await setup.handlers.get('workspace:choose-folder')(setup.event, {});
  assert.deepEqual(result, {
    ok: false,
    failure: {
      kind: 'unauthorized',
      message: 'This window cannot open the folder picker.',
    },
  });
  assert.deepEqual(setup.dialogCalls, []);
});
