'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, net, protocol } = require('electron');

const {
  APP_ORIGIN,
  APP_URL,
  installAppProtocol,
  registerAppScheme,
} = require('./app-protocol.cjs');
const {
  applicationWindowWebPreferences,
  secureApplicationWindow,
} = require('./window-security.cjs');

registerAppScheme(protocol);

const repositoryRoot = path.resolve(__dirname, '..');
const timeout = setTimeout(() => {
  console.error('replacement Electron boundary smoke timed out');
  process.exitCode = 1;
  app.quit();
}, 30_000);

app.whenReady().then(async () => {
  installAppProtocol({
    protocol,
    net,
    rendererRoot: path.join(repositoryRoot, 'dist', 'renderer'),
    serverOrigin: 'http://127.0.0.1:8090',
  });

  const boundary = require(path.join(
    repositoryRoot,
    'dist',
    'electron',
    'workspace-folder-dialog-ipc.cjs',
  ));
  const authorizedWindows = new WeakSet();
  boundary.registerWorkspaceFolderDialogIpc({
    BrowserWindow,
    dialog: {
      async showOpenDialog() {
        return { canceled: true, filePaths: [] };
      },
    },
    ipcMain,
    expectedOrigins: new Set([APP_ORIGIN]),
    isLiveWindow: (window) => authorizedWindows.has(window) && !window.isDestroyed(),
    hasCapability: (window, capability) => (
      authorizedWindows.has(window)
      && capability === boundary.WORKSPACE_FOLDER_DIALOG_CAPABILITY
    ),
  });

  const webPreferences = applicationWindowWebPreferences({
    preloadPath: path.join(repositoryRoot, 'dist', 'electron', 'replacement-preload.cjs'),
  });
  assert.deepEqual(webPreferences, {
    preload: path.join(repositoryRoot, 'dist', 'electron', 'replacement-preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    webviewTag: false,
    experimentalFeatures: false,
    allowRunningInsecureContent: false,
    additionalArguments: [],
  });

  const window = new BrowserWindow({ show: false, webPreferences });
  authorizedWindows.add(window);
  secureApplicationWindow(window, APP_ORIGIN);
  await window.loadURL(APP_URL);

  const result = await window.webContents.executeJavaScript(`
    (async () => {
      delete window.__stashbaseInlineScriptRan;
      const script = document.createElement('script');
      script.textContent = 'window.__stashbaseInlineScriptRan = true';
      document.head.append(script);
      await new Promise((resolve) => setTimeout(resolve, 25));
      const popup = window.open('https://example.com/');
      return {
        folderResult: await window.stashbase.workspace.chooseFolder(),
        globalKeys: Object.keys(window.stashbase),
        nodeGlobal: typeof process,
        popupDenied: popup === null,
        preloadFrozen: Object.isFrozen(window.stashbase),
        inlineScriptDenied: window.__stashbaseInlineScriptRan !== true,
        url: location.href,
        workspaceKeys: Object.keys(window.stashbase.workspace).sort(),
      };
    })()
  `);

  assert.deepEqual(result, {
    folderResult: { ok: true, folderPath: null },
    globalKeys: ['workspace'],
    nodeGlobal: 'undefined',
    popupDenied: true,
    preloadFrozen: true,
    inlineScriptDenied: true,
    url: APP_URL,
    workspaceKeys: ['chooseFolder'],
  });
  console.log('replacement Electron boundary smoke passed');
  clearTimeout(timeout);
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
  clearTimeout(timeout);
  app.quit();
});
