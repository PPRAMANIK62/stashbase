'use strict';

const { isAllowedApplicationUrl } = require('../window-security.cjs');

const WINDOW_ID_HEADER = 'x-stashbase-window-id';

function withTrustedWindowHeader(headers, windowId) {
  const next = { ...headers };
  for (const name of Object.keys(next)) {
    if (name.toLowerCase() === WINDOW_ID_HEADER) delete next[name];
  }
  if (windowId) next[WINDOW_ID_HEADER] = windowId;
  return next;
}

function authorizeRequest(details, {
  rendererOrigins,
  serverOrigin,
  windowRegistrationForWebContentsId,
}) {
  let url;
  try { url = new URL(details.url); } catch { return { cancel: true }; }
  if (url.username || url.password) return { cancel: true };
  const httpOrigin = new URL(serverOrigin).origin;
  const socketOrigin = httpOrigin.replace(/^http:/u, 'ws:').replace(/^https:/u, 'wss:');
  const isHttp = url.origin === httpOrigin;
  const isSocket = url.origin === socketOrigin;
  if (!isHttp && !isSocket) return { cancel: true };

  const vite = rendererOrigins.has(httpOrigin);
  const isRead = details.method === 'GET' || details.method === 'HEAD';
  const isResource = /^\/(?:asset|asset-derived|pdfjs-assets)\//u.test(url.pathname);
  // These read-only resources have their own server-side path/membership
  // checks and also load from document frames and PDF workers. Vite's static
  // requests must work before its initial document has an authorized origin.
  const isViteResource = vite && !/^\/(?:api|ws|mcp)(?:\/|$)/iu.test(url.pathname);
  if (isHttp && isRead && (isResource || isViteResource)) {
    return { cancel: false, requestHeaders: withTrustedWindowHeader(details.requestHeaders) };
  }
  const isViteSocket = vite && isSocket && url.pathname === '/';
  const isCapability = (isHttp && url.pathname.startsWith('/api/'))
    || (isSocket && url.pathname === '/ws/agent');
  if (!isCapability && !isViteSocket) return { cancel: true };
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
    { urls: [`${serverOrigin}/*`, `${websocketOrigin}/*`] },
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
  authorizeRequest,
  installRequestAuthorization,
};
