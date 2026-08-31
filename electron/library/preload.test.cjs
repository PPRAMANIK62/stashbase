'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createLibraryPreload,
} = require('../../dist/electron/library/preload.cjs');

function createIpc(response) {
  const invocations = [];
  return {
    invocations,
    async invoke(channel, payload) {
      invocations.push([channel, payload]);
      if (response instanceof Error) throw response;
      return response;
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
