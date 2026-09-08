'use strict';

const { isAllowedApplicationUrl } = require('../window-security.cjs');

const WINDOW_ID_HEADER = 'x-stashbase-window-id';

function isServerCapabilityUrl(rawUrl, serverOrigin) {
  try {
    const url = new URL(rawUrl);
    const httpOrigin = new URL(serverOrigin);
    const socketOrigin = new URL(serverOrigin);
    socketOrigin.protocol = httpOrigin.protocol === 'https:' ? 'wss:' : 'ws:';
    return (
      (url.origin === httpOrigin.origin && url.pathname.startsWith('/api/'))
      || (url.origin === socketOrigin.origin && url.pathname === '/ws/agent')
    );
  } catch {
    return false;
  }
}

function withTrustedWindowHeader(headers, windowId) {
  const next = { ...headers };
  for (const name of Object.keys(next)) {
    if (name.toLowerCase() === WINDOW_ID_HEADER) delete next[name];
  }
  next[WINDOW_ID_HEADER] = windowId;
  return next;
}

function authorizeRequest(details, {
  rendererOrigins,
  serverOrigin,
  windowRegistrationForWebContentsId,
}) {
  if (!isServerCapabilityUrl(details.url, serverOrigin)) return { cancel: true };
  if (!Number.isSafeInteger(details.webContentsId) || details.webContentsId <= 0) {
    return { cancel: true };
  }
  const registration = windowRegistrationForWebContentsId(details.webContentsId);
  const webContents = registration?.window?.webContents;
  if (
    typeof registration?.windowId !== 'string'
    || !registration.windowId
    || !webContents
    || webContents.isDestroyed()
    || details.webContents !== webContents
    || details.frame !== webContents.mainFrame
    || ![...rendererOrigins].some((origin) => (
      isAllowedApplicationUrl(webContents.getURL(), origin)
    ))
  ) {
    return { cancel: true };
  }
  return {
    cancel: false,
    requestHeaders: withTrustedWindowHeader(details.requestHeaders, registration.windowId),
  };
}

function installRequestAuthorization({
  rendererOrigins,
  serverOrigin,
  session,
  windowRegistrationForWebContentsId,
}) {
  const websocketOrigin = serverOrigin.replace(/^http:/u, 'ws:').replace(/^https:/u, 'wss:');
  session.webRequest.onBeforeSendHeaders(
    { urls: [`${serverOrigin}/api/*`, `${websocketOrigin}/ws/agent*`] },
    (details, callback) => {
      callback(authorizeRequest(details, {
        rendererOrigins,
        serverOrigin,
        windowRegistrationForWebContentsId,
      }));
    },
  );
}

module.exports = {
  WINDOW_ID_HEADER,
  authorizeRequest,
  isServerCapabilityUrl,
  installRequestAuthorization,
};
