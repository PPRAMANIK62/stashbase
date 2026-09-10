'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BUG_REPORT_CAPABILITY,
  registerBugReportOpen,
} = require('../../dist/electron/bug-report/open.cjs');

function harness({ authorized = true, openReview = async () => undefined } = {}) {
  const handlers = new Map();
  const frame = { url: 'app://renderer/' };
  const webContents = { mainFrame: frame };
  const window = { isDestroyed: () => false };
  registerBugReportOpen({
    BrowserWindow: { fromWebContents: (candidate) => (candidate === webContents ? window : null) },
    expectedOrigins: new Set(['app://renderer']),
    hasCapability: (_window, capability) => authorized && capability === BUG_REPORT_CAPABILITY,
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    isLiveWindow: (candidate) => candidate === window,
    openReview,
  });
  return {
    event: { sender: webContents, senderFrame: frame },
    open: handlers.get('bug-report:open'),
    window,
  };
}

test('bug-report open hands the authorized sender window to main and reports success', async () => {
  const opened = [];
  const setup = harness({ openReview: async (window) => opened.push(window) });

  assert.deepEqual(await setup.open(setup.event), { ok: true });
  assert.deepEqual(opened, [setup.window]);
});

test('bug-report open refuses a sender without the capability and never starts a review', async () => {
  const opened = [];
  const denied = harness({ authorized: false, openReview: async (window) => opened.push(window) });

  const response = await denied.open(denied.event);
  assert.equal(response.ok, false);
  assert.equal(response.failure.kind, 'unauthorized');
  assert.deepEqual(opened, []);
});

test('bug-report open refuses a subframe sender and a foreign origin', async () => {
  const setup = harness();
  const subframe = { ...setup.event, senderFrame: { url: 'app://renderer/' } };
  assert.equal((await setup.open(subframe)).failure.kind, 'unauthorized');

  const foreign = {
    sender: setup.event.sender,
    senderFrame: setup.event.sender.mainFrame,
  };
  foreign.sender.mainFrame.url = 'https://example.com/';
  assert.equal((await setup.open(foreign)).failure.kind, 'unauthorized');
});

test('bug-report open fails closed when opening the review throws', async () => {
  const setup = harness({
    openReview: async () => {
      throw new Error('window creation failed');
    },
  });

  const response = await setup.open(setup.event);
  assert.equal(response.ok, false);
  assert.equal(response.failure.kind, 'unavailable');
});
