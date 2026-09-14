'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createProjectPreload,
} = require('../../dist/electron/project/preload.cjs');

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
      return typeof response === 'function' ? response(channel, payload) : response;
    },
    on(channel, listener) {
      listeners.set(channel, listener);
    },
  };
}

test('project preload validates requests and main-process responses', async () => {
  const ipc = createIpc({ ok: true, folderPath: '/workspace/notes', future: true });
  const api = createProjectPreload(ipc);
  assert.deepEqual(await api.chooseFolder(), { ok: true, folderPath: '/workspace/notes' });
  assert.deepEqual(ipc.invocations, [[
    'project:choose-folder',
    { allowCreateDirectory: true },
  ]]);

  await assert.rejects(() => api.chooseFolder({ defaultPath: '' }));
  assert.equal(ipc.invocations.length, 1);

  const malformed = createProjectPreload(createIpc({ ok: true, folderPath: 42 }));
  assert.deepEqual(await malformed.chooseFolder(), {
    ok: false,
    failure: {
      kind: 'invalid-response',
      message: 'The folder picker returned an invalid response.',
    },
  });

  const unavailable = createProjectPreload(createIpc(new Error('private detail')));
  assert.deepEqual(await unavailable.chooseFolder(), {
    ok: false,
    failure: { kind: 'unavailable', message: 'The folder picker is unavailable.' },
  });
});

test('project preload validates lifecycle calls and owns subscription cleanup', async () => {
  const ipc = createIpc((channel) => (
    channel === 'project:prepare-folder-removal'
      ? { ok: true, ready: true }
      : { ok: true }
  ));
  const api = createProjectPreload(ipc);

  assert.deepEqual(await api.setActiveFolder('/workspace/notes'), { ok: true });
  assert.deepEqual(await api.prepareFolderRemoval('/workspace/notes'), {
    ok: true,
    ready: true,
  });
  assert.deepEqual(await api.notifyFolderRemoved('/workspace/notes'), { ok: true });

  const removed = [];
  const unsubscribeRemoved = api.onFolderRemoved((folder) => removed.push(folder));
  ipc.emit('project:folder-removed', { folderPath: '/workspace/notes' });
  ipc.emit('project:folder-removed', { folderPath: 42 });
  unsubscribeRemoved();
  ipc.emit('project:folder-removed', { folderPath: '/workspace/writing' });
  assert.deepEqual(removed, ['/workspace/notes']);

  api.onPrepareFolderRemoval(async (folder) => folder === '/workspace/notes');
  ipc.emit('project:folder-removal-requested', {
    folderPath: '/workspace/notes',
    requestId: 'request-1',
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(ipc.invocations.at(-1), [
    'project:folder-removal-ready',
    { folderPath: '/workspace/notes', ready: true, requestId: 'request-1' },
  ]);
});

test('project preload validates the folder-window call and its answer', async () => {
  const ipc = createIpc({ action: 'focused', ok: true });
  const api = createProjectPreload(ipc);

  assert.deepEqual(await api.openFolderWindow('/workspace/notes'), {
    action: 'focused',
    ok: true,
  });
  assert.deepEqual(ipc.invocations.at(-1), [
    'project:open-folder-window',
    { folderPath: '/workspace/notes' },
  ]);

  // A shape this build does not understand and a bridge that threw both read
  // as a refusal rather than reaching the renderer as a success. The answer is
  // strict: main and this preload ship together, so an unknown action or an
  // unknown field is a bug rather than a newer peer.
  const wrong = createProjectPreload(createIpc({ action: 'teleported', ok: true }));
  assert.equal((await wrong.openFolderWindow('/workspace/notes')).ok, false);
  const extra = createProjectPreload(createIpc({ action: 'opened', ok: true, surprise: 1 }));
  assert.equal((await extra.openFolderWindow('/workspace/notes')).ok, false);
  const broken = createProjectPreload(createIpc(new Error('no bridge')));
  assert.deepEqual(await broken.openFolderWindow('/workspace/notes'), {
    failure: { kind: 'unavailable', message: 'The folder lifecycle is unavailable.' },
    ok: false,
  });
});

test('project preload claims the initial folder and refuses a rewritten answer', async () => {
  const ipc = createIpc({ folderPath: '/workspace/Notes', ok: true });
  const api = createProjectPreload(ipc);

  assert.deepEqual(await api.claimInitialFolder(), {
    folderPath: '/workspace/Notes',
    ok: true,
  });
  // The channel carries nothing: main answers the sender it authorized.
  assert.deepEqual(ipc.invocations.at(-1), ['project:claim-initial-folder', undefined]);

  // No folder is an ordinary answer a caller reads without sorting a failure.
  const none = createProjectPreload(createIpc({ folderPath: null, ok: true }));
  assert.deepEqual(await none.claimInitialFolder(), { folderPath: null, ok: true });

  // Main's refusal of a sender it would not authorize reaches the renderer as
  // that refusal, not as a window with no folder.
  const denied = createProjectPreload(createIpc({
    failure: { kind: 'unauthorized', message: 'This window cannot claim an initial folder.' },
    ok: false,
  }));
  assert.deepEqual(await denied.claimInitialFolder(), {
    failure: { kind: 'unauthorized', message: 'This window cannot claim an initial folder.' },
    ok: false,
  });

  // A shape this build does not understand and a bridge that threw both read
  // as a refusal rather than as a window that was named no folder.
  const malformed = createProjectPreload(createIpc({ folderPath: 42, ok: true }));
  assert.deepEqual(await malformed.claimInitialFolder(), {
    failure: {
      kind: 'invalid-response',
      message: 'The folder lifecycle returned an invalid response.',
    },
    ok: false,
  });
  const extra = createProjectPreload(
    createIpc({ folderPath: '/workspace/Notes', ok: true, restored: true }),
  );
  assert.equal((await extra.claimInitialFolder()).ok, false);
  const broken = createProjectPreload(createIpc(new Error('no bridge')));
  assert.deepEqual(await broken.claimInitialFolder(), {
    failure: { kind: 'unavailable', message: 'The folder lifecycle is unavailable.' },
    ok: false,
  });
});
