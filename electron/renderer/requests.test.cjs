'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authorizeRequest,
  installRequestAuthorization,
} = require('./requests.cjs');

const mainFrame = {};
const registeredWebContents = {
  getURL: () => 'app://renderer/',
  id: 41,
  isDestroyed: () => false,
  mainFrame,
};
const registeredWindow = { webContents: registeredWebContents };
const dependencies = {
  rendererOrigins: new Set(['app://renderer']),
  serverOrigin: 'http://127.0.0.1:8090',
  windowRegistrationForWebContentsId: (webContentsId) =>
    webContentsId === 41
      ? { windowId: 'registered-window', window: registeredWindow }
      : null,
};

test('server request authorization injects main-owned window identity', () => {
  assert.deepEqual(
    authorizeRequest(
      {
        frame: mainFrame,
        requestHeaders: {
          Accept: 'application/json',
          'X-StashBase-Window-Id': 'renderer-forged-id',
        },
        url: 'http://127.0.0.1:8090/api/folder',
        webContents: registeredWebContents,
        webContentsId: 41,
      },
      dependencies,
    ),
    {
      cancel: false,
      requestHeaders: {
        Accept: 'application/json',
        'x-stashbase-window-id': 'registered-window',
      },
    },
  );

  assert.deepEqual(
    authorizeRequest(
      {
        frame: mainFrame,
        requestHeaders: { 'x-stashbase-window-id': 'renderer-forged-id' },
        url: 'ws://127.0.0.1:8090/ws/agent?agent=codex',
        webContents: registeredWebContents,
        webContentsId: 41,
      },
      dependencies,
    ),
    {
      cancel: false,
      requestHeaders: { 'x-stashbase-window-id': 'registered-window' },
    },
  );
});

test('server request authorization denies other origins, targets, and windows', () => {
  for (const details of [
    {
      frame: mainFrame,
      requestHeaders: {},
      url: 'http://127.0.0.1:8090/api/folder',
      webContents: {
        ...registeredWebContents,
        getURL: () => 'https://example.com/',
      },
      webContentsId: 41,
    },
    {
      frame: mainFrame,
      requestHeaders: {},
      url: 'http://127.0.0.1:8091/api/folder',
      webContents: registeredWebContents,
      webContentsId: 41,
    },
    {
      frame: mainFrame,
      requestHeaders: {},
      url: 'http://127.0.0.1:8090/index.html',
      webContents: registeredWebContents,
      webContentsId: 41,
    },
    {
      frame: mainFrame,
      requestHeaders: {},
      url: 'ws://127.0.0.1:8090/ws/codex',
      webContents: registeredWebContents,
      webContentsId: 41,
    },
    {
      frame: mainFrame,
      requestHeaders: {},
      url: 'http://127.0.0.1:8090/api/folder',
      webContents: registeredWebContents,
      webContentsId: 99,
    },
    {
      frame: {},
      requestHeaders: {},
      url: 'http://127.0.0.1:8090/api/folder',
      webContents: registeredWebContents,
      webContentsId: 41,
    },
  ]) {
    assert.deepEqual(authorizeRequest(details, dependencies), { cancel: true });
  }
  assert.deepEqual(
    authorizeRequest(
      {
        frame: mainFrame,
        requestHeaders: {},
        url: 'http://127.0.0.1:8090/api/folder',
        webContents: registeredWebContents,
        webContentsId: 41,
      },
      { ...dependencies, rendererOrigins: new Set(['https://example.com']) },
    ),
    { cancel: true },
  );
});

test('server request authorization observes every server HTTP and WebSocket path', () => {
  let filter;
  let listener;
  installRequestAuthorization({
    ...dependencies,
    session: {
      webRequest: {
        onBeforeSendHeaders(nextFilter, nextListener) {
          filter = nextFilter;
          listener = nextListener;
        },
      },
    },
  });
  assert.deepEqual(filter, {
    urls: ['http://127.0.0.1:8090/*', 'ws://127.0.0.1:8090/*'],
  });
  let result;
  listener(
    {
      frame: mainFrame,
      requestHeaders: {},
      url: 'http://127.0.0.1:8090/api/folder',
      webContents: registeredWebContents,
      webContentsId: 41,
    },
    (value) => { result = value; },
  );
  assert.deepEqual(result, {
    cancel: false,
    requestHeaders: { 'x-stashbase-window-id': 'registered-window' },
  });
});

test('case variants and retired socket routes never gain window authority', () => {
  for (const url of [
    'http://127.0.0.1:8090/API/folder?windowId=other',
    'http://127.0.0.1:8090/Api/folder?windowId=other',
    'ws://127.0.0.1:8090/ws/codex',
    'ws://127.0.0.1:8090/ws/agent-extra',
    'ws://127.0.0.1:8090/',
  ]) {
    assert.deepEqual(authorizeRequest({
      frame: mainFrame,
      requestHeaders: {},
      url,
      webContents: registeredWebContents,
      webContentsId: 41,
    }, dependencies), { cancel: true });
  }
});

test('read-only document and PDF resources retain their separate asset authorization', () => {
  for (const prefix of ['asset', 'asset-derived', 'asset-audio-preview', 'pdfjs-assets']) {
    const details = {
      method: 'GET',
      requestHeaders: { 'X-StashBase-Window-Id': 'forged', Accept: '*/*' },
      url: `http://127.0.0.1:8090/${prefix}/resource`,
    };
    assert.deepEqual(authorizeRequest(details, dependencies), {
      cancel: false, requestHeaders: { Accept: '*/*' },
    });
    assert.deepEqual(authorizeRequest({ ...details, method: 'POST' }, dependencies), { cancel: true });
  }
});

test('only explicit Vite windows get static resources and the root HMR socket', () => {
  const viteWebContents = { ...registeredWebContents, getURL: () => 'http://127.0.0.1:8090/' };
  const vite = {
    ...dependencies,
    rendererOrigins: new Set(['http://127.0.0.1:8090']),
    windowRegistrationForWebContentsId: (id) => id === 41
      ? { windowId: 'vite-window', window: { webContents: viteWebContents } } : null,
  };
  assert.equal(authorizeRequest({ method: 'GET', url: 'http://127.0.0.1:8090/@vite/client' }, vite).cancel, false);
  const socket = {
    frame: mainFrame, webContents: viteWebContents, webContentsId: 41,
    url: 'ws://127.0.0.1:8090/?token=fixture', requestHeaders: {},
  };
  assert.equal(authorizeRequest(socket, vite).cancel, false);
  assert.equal(authorizeRequest({ ...socket, webContentsId: 99 }, vite).cancel, true);
  assert.equal(authorizeRequest({ ...socket, url: 'ws://127.0.0.1:8090/ws/codex' }, vite).cancel, true);
  assert.equal(authorizeRequest({ method: 'GET', url: 'http://127.0.0.1:8090/API/folder' }, vite).cancel, true);
  assert.equal(authorizeRequest({ method: 'GET', url: 'http://127.0.0.1:8090/mcp' }, vite).cancel, true);
});
