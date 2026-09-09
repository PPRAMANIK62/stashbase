import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { UploadApi } from '@/features/workspace/public';
import type { CaptureBridge } from '@/platform/electron/capture';
import type { CaptureImageAvailable } from '@/protocols/electron/capture';

import { ClipboardOffer, dataUrlToBlob } from './clipboard-offer';

const image: CaptureImageAvailable = {
  dataUrl: 'data:image/png;base64,AQID',
  filename: 'clipboard-2026.png',
  hash: 'h1',
  height: 1,
  mime: 'image/png',
  width: 1,
};

function fakeBridge() {
  const handlers = new Set<(image: CaptureImageAvailable) => void>();
  const bridge: CaptureBridge & { emit(image: CaptureImageAvailable): void } = {
    emit: (payload) => handlers.forEach((handler) => handler(payload)),
    markCurrentImageHandled: vi.fn(),
    markHandled: vi.fn(),
    onImageAvailable: vi.fn((handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }),
    refreshWatch: vi.fn(async () => true),
    setComposerFocused: vi.fn(),
  };
  return bridge;
}

let getAnimationsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
});

afterEach(() => {
  cleanup();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});

describe('ClipboardOffer', () => {
  it('decodes base64 data URLs without fetch', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,AQID', 'image/png');
    expect(blob?.type).toBe('image/png');
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(dataUrlToBlob('not-a-data-url', 'image/png')).toBeNull();
  });

  it('refreshes the watch on mount, offers an image, and imports it into the active folder', async () => {
    const bridge = fakeBridge();
    const upload = vi.fn(async () => [{ file: 'clipboard-2026.png' }]);
    const uploadApi: UploadApi = { upload };
    const onImported = vi.fn();
    render(
      <ClipboardOffer
        activeFolderPath="/library/research"
        bridge={bridge}
        onImported={onImported}
        uploadApi={uploadApi}
      />,
    );
    expect(bridge.refreshWatch).toHaveBeenCalledOnce();
    bridge.emit({ ...image, mime: 'text/plain' });
    expect(screen.queryByRole('dialog')).toBeNull();

    bridge.emit(image);
    expect(await screen.findByText('Add image to StashBase?')).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(onImported).toHaveBeenCalledWith({
        folderPath: '/library/research',
        path: 'clipboard-2026.png',
      }),
    );
    expect(upload).toHaveBeenCalledWith(
      '/library/research',
      [expect.objectContaining({ name: 'clipboard-2026.png' })],
      expect.any(AbortSignal),
    );
    expect(bridge.markHandled).toHaveBeenCalledWith('h1');
  });

  it('keeps a failed import visible and marks the image handled on dismiss', async () => {
    const bridge = fakeBridge();
    const uploadApi: UploadApi = {
      upload: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    render(
      <ClipboardOffer activeFolderPath="/library/research" bridge={bridge} uploadApi={uploadApi} />,
    );
    bridge.emit(image);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not save the clipboard image.',
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(bridge.markHandled).toHaveBeenCalledWith('h1');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('holds the offer until a folder is open and does nothing without a bridge', () => {
    const bridge = fakeBridge();
    const uploadApi: UploadApi = { upload: vi.fn(async () => []) };
    const view = render(
      <ClipboardOffer activeFolderPath={null} bridge={bridge} uploadApi={uploadApi} />,
    );
    bridge.emit(image);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(
      <ClipboardOffer activeFolderPath="/library/x" bridge={bridge} uploadApi={uploadApi} />,
    );
    expect(screen.queryByText('Add image to StashBase?')).not.toBeNull();

    cleanup();
    render(<ClipboardOffer activeFolderPath="/library/x" bridge={null} uploadApi={uploadApi} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
