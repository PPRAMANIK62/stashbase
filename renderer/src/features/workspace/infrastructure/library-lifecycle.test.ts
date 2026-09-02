import { describe, expect, it, vi } from 'vite-plus/test';

import { LibraryError } from '@/features/workspace/application/ports';
import type { LibraryLifecycleBridge } from '@/platform/electron/library-lifecycle';

import { createLibraryLifecycle } from './library-lifecycle';

function bridge(overrides: Partial<LibraryLifecycleBridge> = {}): LibraryLifecycleBridge {
  return {
    notifyFolderRemoved: vi.fn(async () => ({ ok: true as const })),
    onFolderRemoved: vi.fn(() => () => undefined),
    onPrepareFolderRemoval: vi.fn(() => () => undefined),
    prepareFolderRemoval: vi.fn(async () => ({ ok: true as const, ready: true })),
    setActiveFolder: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

describe('library lifecycle adapter', () => {
  it('maps the typed bridge without exposing Electron to the feature', async () => {
    const native = bridge();
    const lifecycle = createLibraryLifecycle(native);
    const prepare = vi.fn(async () => true);
    const removed = vi.fn();

    lifecycle.onPrepareFolderRemoval(prepare);
    lifecycle.onFolderRemoved(removed);
    await expect(lifecycle.prepareFolderRemoval('/library/notes')).resolves.toBe(true);
    await expect(lifecycle.setActiveFolder('/library/notes')).resolves.toBeUndefined();
    await expect(lifecycle.notifyFolderRemoved('/library/notes')).resolves.toBeUndefined();

    expect(native.onPrepareFolderRemoval).toHaveBeenCalledWith(prepare);
    expect(native.onFolderRemoved).toHaveBeenCalledWith(removed);
  });

  it('retains classified lifecycle failure', async () => {
    const lifecycle = createLibraryLifecycle(
      bridge({
        prepareFolderRemoval: vi.fn(async () => ({
          failure: { kind: 'unauthorized' as const, message: 'Window retired.' },
          ok: false as const,
        })),
      }),
    );

    await expect(lifecycle.prepareFolderRemoval('/library/notes')).rejects.toEqual(
      new LibraryError('unauthorized', 'Window retired.'),
    );
  });
});
