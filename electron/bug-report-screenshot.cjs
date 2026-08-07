'use strict';

console.log("Screenshot");

/** Capture one already-authorized BrowserWindow's page in memory. This module
 * intentionally accepts WebContents rather than a screen/window selector, so
 * it cannot broaden capture to the desktop or an arbitrary native window. */
async function captureWindowScreenshot(webContents) {
  if (!webContents || typeof webContents.capturePage !== 'function') return null;
  const image = await webContents.capturePage();
  if (!image || typeof image.toPNG !== 'function') return null;
  const bytes = image.toPNG();
  if (!bytes || bytes.length === 0) return null;
  return {
    bytes: Buffer.from(bytes),
    mimeType: 'image/png',
  };
}

module.exports = {
  captureWindowScreenshot,
};
