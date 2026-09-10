'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createLibraryPreload,
} = require('../../dist/electron/library/preload.cjs');

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

test('library preload validates requests and main-process responses', async () => {
  const ipc = createIpc({ ok: true, folderPath: '/workspace/notes', future: true });
  const api = createLibraryPreload(ipc);
  assert.deepEqual(await api.chooseFolder(), { ok: true, folderPath: '/workspace/notes' });
  assert.deepEqual(ipc.invocations, [[
    'library:choose-folder',
    { allowCreateDirectory: true },
  ]]);

  await assert.rejects(() => api.chooseFolder({ defaultPath: '' }));
  assert.equal(ipc.invocations.length, 1);

  const malformed = createLibraryPreload(createIpc({ ok: true, folderPath: 42 }));
  assert.deepEqual(await malformed.chooseFolder(), {
    ok: false,
    failure: {
      kind: 'invalid-response',
      message: 'The folder picker returned an invalid response.',
    },
  });

  const unavailable = createLibraryPreload(createIpc(new Error('private detail')));
  assert.deepEqual(await unavailable.chooseFolder(), {
    ok: false,
    failure: { kind: 'unavailable', message: 'The folder picker is unavailable.' },
  });
});

test('library preload validates lifecycle calls and owns subscription cleanup', async () => {
  const ipc = createIpc((channel) => (
    channel === 'library:prepare-folder-removal'
      ? { ok: true, ready: true }
      : { ok: true }
  ));
  const api = createLibraryPreload(ipc);

  assert.deepEqual(await api.setActiveFolder('/workspace/notes'), { ok: true });
  assert.deepEqual(await api.prepareFolderRemoval('/workspace/notes'), {
    ok: true,
    ready: true,
  });
  assert.deepEqual(await api.notifyFolderRemoved('/workspace/notes'), { ok: true });

  const removed = [];
  const unsubscribeRemoved = api.onFolderRemoved((folder) => removed.push(folder));
  ipc.emit('library:folder-removed', { folderPath: '/workspace/notes' });
  ipc.emit('library:folder-removed', { folderPath: 42 });
  unsubscribeRemoved();
  ipc.emit('library:folder-removed', { folderPath: '/workspace/writing' });
  assert.deepEqual(removed, ['/workspace/notes']);

  api.onPrepareFolderRemoval(async (folder) => folder === '/workspace/notes');
  ipc.emit('library:folder-removal-requested', {
    folderPath: '/workspace/notes',
    requestId: 'request-1',
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(ipc.invocations.at(-1), [
    'library:folder-removal-ready',
    { folderPath: '/workspace/notes', ready: true, requestId: 'request-1' },
  ]);
});

test('library preload validates the folder-window call and its answer', async () => {
  const ipc = createIpc({ action: 'focused', ok: true });
  const api = createLibraryPreload(ipc);

  assert.deepEqual(await api.openFolderWindow('/workspace/notes'), {
    action: 'focused',
    ok: true,
  });
  assert.deepEqual(ipc.invocations.at(-1), [
    'library:open-folder-window',
    { folderPath: '/workspace/notes' },
  ]);

  // A shape this build does not understand and a bridge that threw both read
  // as a refusal rather than reaching the renderer as a success. The answer is
  // strict: main and this preload ship together, so an unknown action or an
  // unknown field is a bug rather than a newer peer.
  const wrong = createLibraryPreload(createIpc({ action: 'teleported', ok: true }));
  assert.equal((await wrong.openFolderWindow('/workspace/notes')).ok, false);
  const extra = createLibraryPreload(createIpc({ action: 'opened', ok: true, surprise: 1 }));
  assert.equal((await extra.openFolderWindow('/workspace/notes')).ok, false);
  const broken = createLibraryPreload(createIpc(new Error('no bridge')));
  assert.deepEqual(await broken.openFolderWindow('/workspace/notes'), {
    failure: { kind: 'unavailable', message: 'The folder lifecycle is unavailable.' },
    ok: false,
  });
});
