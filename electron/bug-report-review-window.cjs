'use strict';

const { pathToFileURL } = require('node:url');

const { applicationWindowWebPreferences, isAllowedApplicationUrl } = require('./window-security.cjs');

const APP_ORIGIN = 'app://renderer';

function createBugReportReviewWindow({
  BrowserWindow,
  preloadPath,
  htmlPath,
  appUrl = null,
  sourceWindow = null,
}) {
  const usesAppUrl = typeof appUrl === 'string';
  if (
    typeof BrowserWindow !== 'function'
    || typeof preloadPath !== 'string'
    || (typeof htmlPath !== 'string' && !usesAppUrl)
  ) {
    throw new TypeError('Review window dependencies are required.');
  }
  const win = new BrowserWindow({
    width: 720,
    height: 728,
    minWidth: 600,
    minHeight: 520,
    show: false,
    title: 'Report a Bug',
    backgroundColor: '#f5f6f8',
    autoHideMenuBar: true,
    fullscreenable: false,
    webPreferences: usesAppUrl
      ? { ...applicationWindowWebPreferences({ preloadPath }), spellcheck: true }
      : {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
        spellcheck: true,
      },
  });
  if (typeof win.setMenuBarVisibility === 'function') win.setMenuBarVisibility(false);
  // Not a child or modal of the source: an open review must survive the
  // source closing. A full-screen source still needs the review presented in
  // its own space; otherwise macOS switches to a separate desktop.
  const sourceIsFullScreen = Boolean(
    sourceWindow
    && (typeof sourceWindow.isDestroyed !== 'function' || !sourceWindow.isDestroyed())
    && typeof sourceWindow.isFullScreen === 'function'
    && sourceWindow.isFullScreen(),
  );
  if (sourceIsFullScreen) {
    if (typeof win.setAlwaysOnTop === 'function') win.setAlwaysOnTop(true, 'floating');
    if (typeof win.setVisibleOnAllWorkspaces === 'function') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    }
  }
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (usesAppUrl) {
    const denyUnexpectedNavigation = (event, url) => {
      if (!isAllowedApplicationUrl(url, APP_ORIGIN)) event.preventDefault();
    };
    win.webContents.on('will-navigate', denyUnexpectedNavigation);
    win.webContents.on('will-redirect', denyUnexpectedNavigation);
    win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  } else {
    const allowedUrl = pathToFileURL(htmlPath).toString();
    win.webContents.on('will-navigate', (event, url) => {
      if (url === allowedUrl || url.startsWith(`${allowedUrl}#`)) return;
      event.preventDefault();
    });
  }
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.show();
  });
  const loaded = Promise.resolve(usesAppUrl ? win.loadURL(appUrl) : win.loadFile(htmlPath));
  return { window: win, loaded };
}

module.exports = { createBugReportReviewWindow };
