'use strict';

function isAllowedApplicationUrl(rawUrl, expectedOrigin) {
  try {
    const url = new URL(rawUrl);
    if (url.username || url.password) return false;
    if (expectedOrigin === 'app://renderer') {
      return url.protocol === 'app:' && url.hostname === 'renderer' && !url.port;
    }
    return url.origin === expectedOrigin;
  } catch {
    return false;
  }
}

function applicationWindowWebPreferences({
  preloadPath,
  additionalArguments = [],
  sandbox = true,
}) {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox,
    webSecurity: true,
    webviewTag: false,
    experimentalFeatures: false,
    allowRunningInsecureContent: false,
    additionalArguments,
  };
}

function secureApplicationWindow(win, expectedOrigin) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const denyUnexpectedNavigation = (event, url) => {
    if (!isAllowedApplicationUrl(url, expectedOrigin)) event.preventDefault();
  };
  win.webContents.on('will-navigate', denyUnexpectedNavigation);
  win.webContents.on('will-redirect', denyUnexpectedNavigation);
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

module.exports = {
  applicationWindowWebPreferences,
  isAllowedApplicationUrl,
  secureApplicationWindow,
};
