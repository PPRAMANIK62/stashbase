'use strict';

const { pathToFileURL } = require('node:url');

function createBugReportReviewWindow({ BrowserWindow, preloadPath, htmlPath, sourceWindow = null }) {
  if (typeof BrowserWindow !== 'function' || typeof preloadPath !== 'string' || typeof htmlPath !== 'string') {
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
    webPreferences: {
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
  const allowedUrl = pathToFileURL(htmlPath).toString();
  win.webContents.on('will-navigate', (event, url) => {
    if (url === allowedUrl || url.startsWith(`${allowedUrl}#`)) return;
    event.preventDefault();
  });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.show();
  });
  const loaded = Promise.resolve(win.loadFile(htmlPath));
  return { window: win, loaded };
}

module.exports = { createBugReportReviewWindow };
