'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CAPTURE_CAPABILITY,
  clipboardImageFilename,
  registerCaptureMonitor,
} = require('../../dist/electron/capture/monitor.cjs');
const { shouldOfferClipboardImage } = require('../clipboard-watch-policy.cjs');

function windowFixture(id, focused = true) {
  const frame = { url: 'app://renderer/' };
  const sent = [];
  const webContents = {
    id,
    mainFrame: frame,
    isDestroyed: () => false,
    send: (channel, payload) => sent.push([channel, payload]),
  };
  const window = {
    isDestroyed: () => false,
    isFocused: () => focused,
    webContents,
  };
  return { event: { sender: webContents, senderFrame: frame }, sent, window };
}

function fakeImage(bytes) {
  return {
    isEmpty: () => bytes.length === 0,
    toPNG: () => Buffer.from(bytes),
    toDataURL: () => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`,
    getSize: () => ({ width: 2, height: 3 }),
  };
}

function harness({ preference = true, clipboardBytes = 'png-1' } = {}) {
  const handlers = new Map();
  const listeners = new Map();
  const first = windowFixture(11);
  const state = { bytes: clipboardBytes, preference, timers: [] };
  const dependencies = {
    BrowserWindow: { fromWebContents: (contents) => (contents === first.window.webContents ? first.window : null) },
    clipboard: { readImage: () => fakeImage(state.bytes) },
    expectedOrigins: new Set(['app://renderer']),
    focusedWindow: () => first.window,
    hasCapability: (_window, capability) => capability === CAPTURE_CAPABILITY,
    ipcMain: {
      handle: (channel, handler) => handlers.set(channel, handler),
      on: (channel, listener) => listeners.set(channel, listener),
    },
    isLiveWindow: () => true,
    readPreference: async () => {
      if (state.preference instanceof Error) throw state.preference;
      return state.preference;
    },
    setInterval: (fn) => {
      state.timers.push(fn);
      return state.timers.length;
    },
    clearInterval: () => {
      state.timers.length = 0;
    },
    shouldOffer: shouldOfferClipboardImage,
  };
  const monitor = registerCaptureMonitor(dependencies);
  return { first, handlers, listeners, monitor, state };
}

test('filename is a sortable timestamped png', () => {
  assert.equal(
    clipboardImageFilename(new Date('2026-09-09T01:02:03.004Z')),
    'clipboard-2026-09-09T01-02-03-004Z.png',
  );
});

test('refresh reads the durable opt-in, offers once per image, and starts focus polling', async () => {
  const { first, handlers, state } = harness();
  const refresh = handlers.get('capture:refresh-watch');
  assert.deepEqual(await refresh(first.event), { enabled: true });
  assert.equal(first.sent.length, 1);
  const [channel, payload] = first.sent[0];
  assert.equal(channel, 'capture:image-available');
  assert.equal(payload.mime, 'image/png');
  assert.equal(payload.width, 2);
  assert.match(payload.filename, /^clipboard-.*\.png$/);
  assert.equal(state.timers.length, 1);

  state.timers[0]();
  assert.equal(first.sent.length, 1, 'same image is not re-offered');
  state.bytes = 'png-2';
  state.timers[0]();
  assert.equal(first.sent.length, 2, 'a new clipboard image is offered');
});

test('refresh fails closed when the preference cannot be read or is off', async () => {
  const failing = harness({ preference: new Error('server down') });
  assert.deepEqual(await failing.handlers.get('capture:refresh-watch')(failing.first.event), {
    enabled: false,
  });
  assert.equal(failing.first.sent.length, 0);
  assert.equal(failing.state.timers.length, 0);

  const off = harness({ preference: false });
  assert.deepEqual(await off.handlers.get('capture:refresh-watch')(off.first.event), {
    enabled: false,
  });
  assert.equal(off.first.sent.length, 0);
});

test('unauthorized senders cannot enable the watch or mark images', async () => {
  const { handlers, listeners, first, state } = harness();
  const foreign = { sender: { id: 99, mainFrame: { url: 'https://example.com/' } }, senderFrame: { url: 'https://example.com/' } };
  assert.deepEqual(await handlers.get('capture:refresh-watch')(foreign), { enabled: false });
  assert.equal(state.timers.length, 0);

  await handlers.get('capture:refresh-watch')(first.event);
  listeners.get('capture:mark-handled')(foreign, { hash: 'x' });
  state.bytes = 'png-3';
  state.timers[0]();
  assert.equal(first.sent.length, 2);
});

test('a focused composer suppresses offers and handled hashes are not re-offered', async () => {
  const { handlers, listeners, first, state } = harness();
  await handlers.get('capture:refresh-watch')(first.event);
  assert.equal(first.sent.length, 1);

  listeners.get('capture:set-composer-focused')(first.event, { focused: true });
  state.bytes = 'png-2';
  state.timers[0]();
  assert.equal(first.sent.length, 1, 'composer focus claims the clipboard');

  listeners.get('capture:set-composer-focused')(first.event, { focused: false });
  state.bytes = 'png-3';
  listeners.get('capture:mark-current-handled')(first.event);
  state.timers[0]();
  assert.equal(first.sent.length, 1, 'current image was marked handled');

  state.bytes = 'png-4';
  state.timers[0]();
  assert.equal(first.sent.length, 2);
  listeners.get('capture:mark-handled')(first.event, { hash: first.sent[1][1].hash });
  state.timers[0]();
  assert.equal(first.sent.length, 2);
});
