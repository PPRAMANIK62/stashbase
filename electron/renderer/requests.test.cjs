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

test('server request authorization installs one exact-origin request filter', () => {
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
  assert.deepEqual(filter, { urls: ['http://127.0.0.1:8090/api/*'] });
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
