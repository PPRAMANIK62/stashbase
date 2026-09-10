'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createCapturePreload } = require('../../dist/electron/capture/preload.cjs');

function createIpc(response) {
  const invocations = [];
  const sends = [];
  const listeners = new Map();
  return {
    invocations,
    sends,
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
    send(channel, payload) {
      sends.push([channel, payload]);
    },
  };
}

const image = {
  dataUrl: 'data:image/png;base64,AAAA',
  filename: 'clipboard-2026-09-09T00-00-00-000Z.png',
  hash: 'abc',
  height: 1,
  mime: 'image/png',
  width: 1,
};

test('capture preload validates pushed images and owns subscription cleanup', () => {
  const ipc = createIpc({ enabled: true });
  const api = createCapturePreload(ipc);
  const seen = [];
  const unsubscribe = api.onImageAvailable((payload) => seen.push(payload));
  ipc.emit('capture:image-available', { ...image, extra: true });
  ipc.emit('capture:image-available', { hash: 'no-image' });
  ipc.emit('capture:image-available', image);
  assert.equal(seen.length, 1);
  unsubscribe();
  ipc.emit('capture:image-available', image);
  assert.equal(seen.length, 1);
});

test('capture preload fails closed on refresh errors and validates sends', async () => {
  const ipc = createIpc({ enabled: true });
  const api = createCapturePreload(ipc);
  assert.equal(await api.refreshWatch(), true);
  assert.deepEqual(ipc.invocations, [['capture:refresh-watch', undefined]]);

  assert.equal(await createCapturePreload(createIpc(new Error('boom'))).refreshWatch(), false);
  assert.equal(await createCapturePreload(createIpc(true)).refreshWatch(), false);

  api.markHandled('abc');
  api.markHandled('');
  api.markCurrentImageHandled();
  api.setComposerFocused('yes');
  assert.deepEqual(ipc.sends, [
    ['capture:mark-handled', { hash: 'abc' }],
    ['capture:mark-current-handled', undefined],
    ['capture:set-composer-focused', { focused: false }],
  ]);
});
