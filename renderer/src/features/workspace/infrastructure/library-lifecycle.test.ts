import { describe, expect, it, vi } from 'vite-plus/test';

import { LibraryError } from '@/features/workspace/application/ports';
import type { LibraryLifecycleBridge } from '@/platform/electron/library-lifecycle';

import { createLibraryLifecycleAdapter } from './library-lifecycle';

function bridge(overrides: Partial<LibraryLifecycleBridge> = {}): LibraryLifecycleBridge {
  return {
    claimInitialFolder: vi.fn(async () => ({ folderPath: null, ok: true as const })),
    notifyFolderRemoved: vi.fn(async () => ({ ok: true as const })),
    onFolderRemoved: vi.fn(() => () => undefined),
    onPrepareFolderRemoval: vi.fn(() => () => undefined),
    openFolderWindow: vi.fn(async () => ({ action: 'opened' as const, ok: true as const })),
    prepareFolderRemoval: vi.fn(async () => ({ ok: true as const, ready: true })),
    setActiveFolder: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

describe('library lifecycle adapter', () => {
  it('maps the typed bridge without exposing Electron to the feature', async () => {
    const native = bridge();
    const lifecycle = createLibraryLifecycleAdapter(native);
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
    const lifecycle = createLibraryLifecycleAdapter(
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

  it('asks the desktop for the initial folder once and answers the same folder after', async () => {
    const native = bridge({
      claimInitialFolder: vi.fn(async () => ({
        folderPath: '/library/Notes' as string | null,
        ok: true as const,
      })),
    });
    const lifecycle = createLibraryLifecycleAdapter(native);

    // The desktop answers once and then forgets, so a second ask must not read
    // that forgetting as "this window was created for no folder".
    await expect(lifecycle.claimInitialFolder()).resolves.toBe('/library/Notes');
    await expect(lifecycle.claimInitialFolder()).resolves.toBe('/library/Notes');
    expect(native.claimInitialFolder).toHaveBeenCalledOnce();
  });

  it('reads a refused claim as a window with no folder named for it', async () => {
    // Unlike the other lifecycle calls this does not raise. There is no
    // recovery to offer and nothing to tell the reader: the window still works,
    // it just lands wherever it would have landed anyway.
    const lifecycle = createLibraryLifecycleAdapter(
      bridge({
        claimInitialFolder: vi.fn(async () => ({
          failure: { kind: 'unauthorized' as const, message: 'Window retired.' },
          ok: false as const,
        })),
      }),
    );

    await expect(lifecycle.claimInitialFolder()).resolves.toBeNull();
  });
});
