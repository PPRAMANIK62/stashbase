import { describe, expect, it, vi } from 'vite-plus/test';

import type { CaptureImageAvailable } from '@/protocols/electron/capture';
import { captureBridge } from '@/test/fakes/app';

import { createClipboardCaptureAdapter } from './capture-api';

const image: CaptureImageAvailable = {
  dataUrl: 'data:image/png;base64,AQID',
  filename: 'clipboard-2026.png',
  hash: 'h1',
  height: 1,
  mime: 'image/png',
  width: 1,
};

/** The capture bridge, plus a hook so a test can push an image the way the
 *  desktop watch would. */
function bridgeWithWatch() {
  const handlers = new Set<(payload: CaptureImageAvailable) => void>();
  return {
    ...captureBridge({
      onImageAvailable: vi.fn((handler: (payload: CaptureImageAvailable) => void) => {
        handlers.add(handler);
        return () => handlers.delete(handler);
      }),
    }),
    emit: (payload: CaptureImageAvailable) => handlers.forEach((handler) => handler(payload)),
  };
}

describe('clipboard capture adapter', () => {
  it('decodes a base64 data URL into bytes without fetch', async () => {
    const bridge = bridgeWithWatch();
    const offers: Blob[] = [];
    createClipboardCaptureAdapter(bridge).subscribe((offer) => offers.push(offer.bytes));

    bridge.emit(image);

    const bytes = offers[0];
    if (!bytes) throw new Error('A base64 data URL must decode to an offer.');
    expect(bytes.type).toBe('image/png');
    expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('names the offer by the hash the desktop settles it under', () => {
    const bridge = bridgeWithWatch();
    const ids: string[] = [];
    const port = createClipboardCaptureAdapter(bridge);
    port.subscribe((offer) => ids.push(`${offer.id}:${offer.name}`));

    bridge.emit(image);
    port.settle('h1');

    expect(ids).toEqual(['h1:clipboard-2026.png']);
    expect(bridge.markHandled).toHaveBeenCalledWith('h1');
  });

  it('offers nothing it could not import: a non-image, or a body it cannot decode', () => {
    const bridge = bridgeWithWatch();
    const offers: string[] = [];
    createClipboardCaptureAdapter(bridge).subscribe((offer) => offers.push(offer.id));

    bridge.emit({ ...image, mime: 'text/plain' });
    bridge.emit({ ...image, dataUrl: 'not-a-data-url', hash: 'h2' });

    expect(offers).toEqual([]);
  });

  it('starts the watch without letting a refused start reach a caller', () => {
    const bridge = captureBridge({
      refreshWatch: vi.fn(async () => Promise.reject(new Error('no'))),
    });

    expect(() => createClipboardCaptureAdapter(bridge).refresh()).not.toThrow();
    expect(bridge.refreshWatch).toHaveBeenCalledOnce();
  });
});
