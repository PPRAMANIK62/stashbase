import { describe, expect, it, vi } from 'vite-plus/test';

import { applyCaptureWatch, isCaptureBridge } from './capture';

const bridge = {
  markCurrentImageHandled: vi.fn(),
  markHandled: vi.fn(),
  onImageAvailable: vi.fn(() => () => undefined),
  refreshWatch: vi.fn(async () => true),
  setComposerFocused: vi.fn(),
};

describe('capture bridge', () => {
  it('recognises only a complete capability', () => {
    expect(isCaptureBridge(bridge)).toBe(true);
    expect(isCaptureBridge({ refreshWatch: bridge.refreshWatch })).toBe(false);
    expect(isCaptureBridge(null)).toBe(false);
  });

  it('reports whether the desktop applied the expected watch state', async () => {
    await expect(applyCaptureWatch(bridge, true)).resolves.toBe(true);
    await expect(applyCaptureWatch(bridge, false)).resolves.toBe(false);
    await expect(
      applyCaptureWatch(
        {
          ...bridge,
          refreshWatch: vi.fn(async () => {
            throw new Error('ipc down');
          }),
        },
        true,
      ),
    ).resolves.toBe(false);
    await expect(applyCaptureWatch(null, true)).resolves.toBe(true);
  });
});
