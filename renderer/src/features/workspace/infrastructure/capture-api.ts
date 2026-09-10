import type {
  ClipboardCapturePort,
  ClipboardImageOffer,
} from '@/features/workspace/application/ports';
import type { CaptureBridge } from '@/platform/electron/capture';

/** CSP forbids `fetch(data:)`, so the base64 body is decoded by hand. */
function dataUrlToBlob(dataUrl: string, fallbackMime: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/su.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || fallbackMime;
  const payload = match[3] ?? '';
  try {
    if (match[2]) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch {
    return null;
  }
}

/**
 * The desktop clipboard watch, as bytes the feature can import.
 *
 * The offer arrives as a data URL of some declared type; neither is anything a
 * dialog should reason about. What is not an image, and what cannot be decoded,
 * is not offered at all — an offer the app could not act on is worse than no
 * offer, and it used to reach the reader as a sentence about a failed save.
 */
export function createClipboardCaptureAdapter(bridge: CaptureBridge): ClipboardCapturePort {
  return {
    refresh() {
      // Best effort: a watch that will not start simply never offers anything.
      // swallowed: the offer is optional, so a refused refresh has no reader.
      void bridge.refreshWatch().catch(() => undefined);
    },
    settle(id) {
      bridge.markHandled(id);
    },
    subscribe(handler) {
      return bridge.onImageAvailable((image) => {
        if (!image.mime.startsWith('image/')) return;
        const bytes = dataUrlToBlob(image.dataUrl, image.mime);
        if (!bytes) return;
        const offer: ClipboardImageOffer = { bytes, id: image.hash, name: image.filename };
        handler(offer);
      });
    },
  };
}
