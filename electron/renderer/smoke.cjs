'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, net, protocol, session } = require('electron');

const {
  APP_ORIGIN,
  APP_URL,
  installAppProtocol,
  registerAppScheme,
} = require('../app-protocol.cjs');
const {
  applicationWindowWebPreferences,
  secureApplicationWindow,
} = require('../window-security.cjs');
const { installRequestAuthorization } = require('./requests.cjs');

registerAppScheme(protocol);

const repositoryRoot = path.resolve(__dirname, '../..');
let libraryServer;
const timeout = setTimeout(() => {
  console.error('replacement Electron boundary smoke timed out');
  app.exit(1);
}, 30_000);

app
  .whenReady()
  .then(async () => {
    let receivedLibraryRequest = null;
    let libraryMembers = [];
    libraryServer = http.createServer((request, response) => {
      response.setHeader('Access-Control-Allow-Origin', APP_ORIGIN);
      response.setHeader('Access-Control-Allow-Headers', 'content-type');
      response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
      if (request.method === 'OPTIONS') {
        response.statusCode = 204;
        response.end();
        return;
      }
      response.setHeader('Content-Type', 'application/json');
      receivedLibraryRequest = {
        method: request.method,
        origin: request.headers.origin,
        windowId: request.headers['x-stashbase-window-id'],
      };
      response.end(JSON.stringify({ current: null, homeDir: '/library', recent: libraryMembers }));
    });
    await new Promise((resolve, reject) => {
      libraryServer.once('error', reject);
      libraryServer.listen(0, '127.0.0.1', resolve);
    });
    const address = libraryServer.address();
    assert.ok(address && typeof address === 'object');
    const serverOrigin = `http://127.0.0.1:${address.port}`;

    installAppProtocol({
      protocol,
      net,
      rendererRoot: path.join(repositoryRoot, 'dist', 'renderer'),
      serverOrigin,
    });

    const boundary = require(
      path.join(repositoryRoot, 'dist', 'electron', 'library', 'dialog.cjs'),
    );
    const authorizedWindows = new WeakSet();
    boundary.registerDialog({
      BrowserWindow,
      dialog: {
        async showOpenDialog() {
          return { canceled: true, filePaths: [] };
        },
      },
      ipcMain,
      expectedOrigins: new Set([APP_ORIGIN]),
      isLiveWindow: (window) => authorizedWindows.has(window) && !window.isDestroyed(),
      hasCapability: (window, capability) =>
        authorizedWindows.has(window) && capability === boundary.LIBRARY_FOLDER_DIALOG_CAPABILITY,
    });

    const webPreferences = applicationWindowWebPreferences({
      preloadPath: path.join(repositoryRoot, 'dist', 'electron', 'renderer', 'preload.cjs'),
      additionalArguments: [`--stashbase-server-origin=${serverOrigin}`],
    });
    assert.deepEqual(webPreferences, {
      preload: path.join(repositoryRoot, 'dist', 'electron', 'renderer', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      experimentalFeatures: false,
      allowRunningInsecureContent: false,
      additionalArguments: [`--stashbase-server-origin=${serverOrigin}`],
    });

    const window = new BrowserWindow({ show: false, webPreferences });
    installRequestAuthorization({
      rendererOrigins: new Set([APP_ORIGIN]),
      serverOrigin,
      session: session.defaultSession,
      windowRegistrationForWebContentsId: (webContentsId) =>
        webContentsId === window.webContents.id
          ? { windowId: 'replacement-smoke-window', window }
          : null,
    });
    authorizedWindows.add(window);
    secureApplicationWindow(window, APP_ORIGIN);
    await window.loadURL(APP_URL);

    const result = await window.webContents.executeJavaScript(`
    (async () => {
      const welcomeDeadline = Date.now() + 5000;
      while (
        ![...document.querySelectorAll('button')]
          .some((button) => button.textContent?.trim() === 'Open folder')
        && Date.now() < welcomeDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      delete window.__stashbaseInlineScriptRan;
      const script = document.createElement('script');
      script.textContent = 'window.__stashbaseInlineScriptRan = true';
      document.head.append(script);
      await new Promise((resolve) => setTimeout(resolve, 25));
      const popup = window.open('https://example.com/');
      return {
        folderResult: await window.stashbase.library.chooseFolder(),
        globalKeys: Object.keys(window.stashbase),
        librarySnapshot: await fetch(
          window.stashbase.runtime.serverOrigin + '/api/library/folders/open',
          {
            body: JSON.stringify({ path: '/library/notes' }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        ).then((response) => response.json()),
        nodeGlobal: typeof process,
        popupDenied: popup === null,
        preloadFrozen: Object.isFrozen(window.stashbase),
        runtime: window.stashbase.runtime,
        runtimeFrozen: Object.isFrozen(window.stashbase.runtime),
        inlineScriptDenied: window.__stashbaseInlineScriptRan !== true,
        welcomeActions: [...document.querySelectorAll('button')]
          .map((button) => button.textContent?.trim())
          .filter((label) => label === 'Open folder' || label === 'Create folder')
          .sort(),
        welcomeTitle: document.querySelector('h1')?.textContent?.trim(),
        workspaceMarginLeft: getComputedStyle(
          document.querySelector('[data-slot="sidebar-inset"]'),
        ).marginLeft,
        url: location.href,
        libraryKeys: Object.keys(window.stashbase.library).sort(),
      };
    })()
  `);

    assert.deepEqual(result, {
      folderResult: { ok: true, folderPath: null },
      globalKeys: ['runtime', 'library'],
      nodeGlobal: 'undefined',
      popupDenied: true,
      preloadFrozen: true,
      librarySnapshot: { current: null, homeDir: '/library', recent: [] },
      runtime: { serverOrigin },
      runtimeFrozen: true,
      inlineScriptDenied: true,
      welcomeActions: ['Create folder', 'Open folder'],
      welcomeTitle: 'StashBase',
      workspaceMarginLeft: '0px',
      url: APP_URL,
      libraryKeys: ['chooseFolder'],
    });
    assert.deepEqual(receivedLibraryRequest, {
      method: 'POST',
      origin: APP_ORIGIN,
      windowId: 'replacement-smoke-window',
    });

    libraryMembers = [
      {
        favorite: false,
        openedAt: '2026-09-01T00:00:00.000Z',
        path: '/library/engineering-blogs',
      },
    ];
    const didReload = new Promise((resolve) => window.webContents.once('did-finish-load', resolve));
    window.reload();
    await didReload;
    const folderCursor = await window.webContents.executeJavaScript(`
      (async () => {
        const deadline = Date.now() + 5000;
        let row;
        while (!row && Date.now() < deadline) {
          row = document.querySelector('button[title="/library/engineering-blogs"]');
          if (!row) await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return row ? getComputedStyle(row).cursor : null;
      })()
    `);
    assert.equal(folderCursor, 'pointer');
    console.log('replacement Electron boundary smoke passed');
    clearTimeout(timeout);
    window.destroy();
    libraryServer.closeAllConnections();
    await new Promise((resolve) => libraryServer.close(resolve));
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    clearTimeout(timeout);
    if (libraryServer?.listening) {
      libraryServer.closeAllConnections();
      libraryServer.close();
    }
    app.exit(1);
  });
