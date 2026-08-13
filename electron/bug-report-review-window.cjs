'use strict';

const { pathToFileURL } = require('node:url');

function createBugReportReviewWindow({ BrowserWindow, preloadPath, htmlPath }) {
  if (typeof BrowserWindow !== 'function' || typeof preloadPath !== 'string' || typeof htmlPath !== 'string') {
    throw new TypeError('Review window dependencies are required.');
  }
  const win = new BrowserWindow({
    width: 900,
    height: 780,
    minWidth: 680,
    minHeight: 600,
    show: false,
    title: 'Report a Bug',
    backgroundColor: '#f7f7f5',
    autoHideMenuBar: true,
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
