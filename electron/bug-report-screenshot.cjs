'use strict';

const MAX_SCREENSHOT_BYTES = 16 * 1024 * 1024;
const MAX_SCREENSHOT_EDGE = 16_384;

/** Capture one already-authorized BrowserWindow's page in memory. This module
 * intentionally accepts WebContents rather than a screen/window selector, so
 * it cannot broaden capture to the desktop or an arbitrary native window. The
 * lossless PNG is the single screenshot resource retained for both review and
 * any future approved outcome; no lossy or scaled approximation is created. */
async function captureWindowScreenshot(webContents) {
  if (!webContents || typeof webContents.capturePage !== 'function') return null;
  const image = await webContents.capturePage();
  if (
    !image
    || typeof image.toPNG !== 'function'
    || typeof image.getSize !== 'function'
  ) return null;
  const bytes = image.toPNG();
  if (!bytes || bytes.length === 0 || bytes.length > MAX_SCREENSHOT_BYTES) return null;
  const size = image.getSize();
  if (
    !size
    || !Number.isSafeInteger(size.width)
    || !Number.isSafeInteger(size.height)
    || size.width <= 0
    || size.height <= 0
    || size.width > MAX_SCREENSHOT_EDGE
    || size.height > MAX_SCREENSHOT_EDGE
  ) {
    return null;
  }
  return {
    bytes: Buffer.from(bytes),
    mimeType: 'image/png',
    width: size.width,
    height: size.height,
  };
}

module.exports = {
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOT_EDGE,
  captureWindowScreenshot,
};
