'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  WINDOW_LIFECYCLE_CAPABILITY,
  registerWindowLifecycle,
} = require('../../dist/electron/window/lifecycle.cjs');

function harness({ load = true } = {}) {
  const handlers = new Map();
  const windowHandlers = new Map();
  const webContentsHandlers = new Map();
  const sent = [];
  const frame = { url: 'app://renderer/' };
  let closeCalls = 0;
  let reloadCalls = 0;
  const webContents = {
    id: 41,
    isDestroyed: () => false,
    mainFrame: frame,
    on: (event, handler) => webContentsHandlers.set(event, handler),
    reload: () => {
      reloadCalls += 1;
    },
    send: (channel, payload) => sent.push([channel, payload]),
  };
  const window = {
    close: () => {
      closeCalls += 1;
    },
    isDestroyed: () => false,
    on: (event, handler) => windowHandlers.set(event, handler),
    webContents,
  };
  const dependencies = {
    BrowserWindow: { fromWebContents: (candidate) => (candidate === webContents ? window : null) },
    expectedOrigins: new Set(['app://renderer']),
    hasCapability: (_window, capability) => capability === WINDOW_LIFECYCLE_CAPABILITY,
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    isLiveWindow: (candidate) => candidate === window,
  };
  const lifecycle = registerWindowLifecycle(dependencies, {
    createRequestId: () => `request-${sent.length + 1}`,
    timeoutMs: 1_000,
  });
  lifecycle.attach(window);
  const finishLoad = () => webContentsHandlers.get('did-finish-load')();
  if (load) finishLoad();
  const event = { sender: webContents, senderFrame: frame };
  return {
    close: (payload) => windowHandlers.get('close')(payload),
    closeCalls: () => closeCalls,
    event,
    finishLoad,
    handlers,
    lifecycle,
    reloadCalls: () => reloadCalls,
    sent,
    window,
  };
}

test('native close waits for the renderer barrier and remains open after failure', async () => {
  const setup = harness();
  let prevented = 0;
  setup.close({
    preventDefault: () => {
      prevented += 1;
    },
  });
  const request = setup.sent.at(-1)[1];
  setup.close({
    preventDefault: () => {
      prevented += 1;
    },
  });
  assert.equal(prevented, 2);
  assert.equal(setup.sent.length, 1);
  assert.equal(setup.closeCalls(), 0);

  const ready = setup.handlers.get('window:context-release-ready');
  await ready(setup.event, { ...request, ready: false });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(setup.closeCalls(), 0);

  setup.close({
    preventDefault: () => {
      prevented += 1;
    },
  });
  const retry = setup.sent.at(-1)[1];
  await ready(setup.event, { ...retry, ready: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(setup.closeCalls(), 1);
});

test('safe reload crosses the same barrier and excludes a competing close', async () => {
  const setup = harness();
  const reload = setup.handlers.get('window:safe-reload');
  const reloading = reload(setup.event);
  const request = setup.sent.at(-1)[1];

  setup.close({ preventDefault: () => undefined });
  const ready = setup.handlers.get('window:context-release-ready');
  await ready(setup.event, { ...request, ready: true });

  assert.deepEqual(await reloading, { ok: true, reloaded: true });
  assert.equal(setup.reloadCalls(), 1);
  assert.equal(setup.closeCalls(), 0);
});

test('the lifecycle service reports renderer readiness only after the first load', () => {
  const setup = harness({ load: false });
  assert.equal(setup.lifecycle.hasLoadedRenderer(setup.window), false);
  setup.finishLoad();
  assert.equal(setup.lifecycle.hasLoadedRenderer(setup.window), true);
});

test('an update install release crosses the same renderer barrier', async () => {
  const setup = harness();
  const releasing = setup.lifecycle.requestContextRelease(setup.window, 'update-install');
  assert.deepEqual(setup.sent.at(-1), [
    'window:prepare-context-release',
    { reason: 'update-install', requestId: 'request-1' },
  ]);

  const ready = setup.handlers.get('window:context-release-ready');
  await ready(setup.event, { ...setup.sent.at(-1)[1], ready: true });
  assert.equal(await releasing, true);
  assert.equal(setup.closeCalls(), 0);
});

test('an approved close skips the barrier until the approval is revoked', async () => {
  const setup = harness();
  let prevented = 0;
  const closeEvent = {
    preventDefault: () => {
      prevented += 1;
    },
  };

  setup.lifecycle.approveClose(setup.window);
  setup.close(closeEvent);
  assert.equal(prevented, 0);
  assert.equal(setup.sent.length, 0);

  setup.lifecycle.revokeCloseApproval(setup.window);
  setup.close(closeEvent);
  assert.equal(prevented, 1);
  assert.equal(setup.sent.length, 1);
  assert.equal(setup.sent.at(-1)[1].reason, 'window-close');

  const ready = setup.handlers.get('window:context-release-ready');
  await ready(setup.event, { ...setup.sent.at(-1)[1], ready: false });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(setup.closeCalls(), 0);
});
