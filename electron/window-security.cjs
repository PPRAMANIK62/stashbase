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
}) {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    webviewTag: false,
    experimentalFeatures: false,
    allowRunningInsecureContent: false,
    additionalArguments,
  };
}

/**
 * The one permission an application window is granted, and only to its own
 * origin: putting a value the reader asked a panel to copy onto the clipboard.
 *
 * This is the write, and only the write. Chromium sanitizes the payload, and
 * the app never reads the clipboard through this API — a paste arrives as an
 * event, which needs no permission — so reading stays denied along with
 * everything else. The grant reaches the bundled renderer and nothing else:
 * document content renders at an opaque origin with no permission capability
 * at all, which is one more reason that frame may never take
 * `allow-same-origin`.
 *
 * The name is the one Chromium asks under, not the one that reads best. Verify
 * a change to it by driving the real window: a handler that answers the wrong
 * name denies silently, and the renderer reports only that the clipboard could
 * not be reached.
 */
const CLIPBOARD_PERMISSION = 'clipboard-sanitized-write';

/** The requesting document decides this, not the window: `requestingUrl` is
 *  the frame that asked, so a frame at any other origin is refused even
 *  though the window around it is the application's. */
function isApplicationClipboardRequest(permission, details, expectedOrigin) {
  if (permission !== CLIPBOARD_PERMISSION) return false;
  const requestingUrl = details && details.requestingUrl;
  return typeof requestingUrl === 'string' && isAllowedApplicationUrl(requestingUrl, expectedOrigin);
}

function secureApplicationWindow(win, expectedOrigin) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const denyUnexpectedNavigation = (event, url) => {
    if (!isAllowedApplicationUrl(url, expectedOrigin)) event.preventDefault();
  };
  win.webContents.on('will-navigate', denyUnexpectedNavigation);
  win.webContents.on('will-redirect', denyUnexpectedNavigation);
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  // Nothing is granted ambiently. A capability a page can hold without asking
  // is one it can use without the reader having done anything.
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      callback(isApplicationClipboardRequest(permission, details, expectedOrigin));
    },
  );
}

module.exports = {
  applicationWindowWebPreferences,
  isAllowedApplicationUrl,
  secureApplicationWindow,
};
