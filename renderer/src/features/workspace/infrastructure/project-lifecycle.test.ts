import { describe, expect, it, vi } from 'vite-plus/test';

import { ProjectError } from '@/features/workspace/application/ports';
import type { ProjectLifecycleBridge } from '@/platform/electron/project-lifecycle';

import { createProjectLifecycleAdapter } from './project-lifecycle';

function bridge(overrides: Partial<ProjectLifecycleBridge> = {}): ProjectLifecycleBridge {
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

describe('project lifecycle adapter', () => {
  it('maps the typed bridge without exposing Electron to the feature', async () => {
    const native = bridge();
    const lifecycle = createProjectLifecycleAdapter(native);
    const prepare = vi.fn(async () => true);
    const removed = vi.fn();

    lifecycle.onPrepareFolderRemoval(prepare);
    lifecycle.onFolderRemoved(removed);
    await expect(lifecycle.prepareFolderRemoval('/project/notes')).resolves.toBe(true);
    await expect(lifecycle.setActiveFolder('/project/notes')).resolves.toBeUndefined();
    await expect(lifecycle.notifyFolderRemoved('/project/notes')).resolves.toBeUndefined();

    expect(native.onPrepareFolderRemoval).toHaveBeenCalledWith(prepare);
    expect(native.onFolderRemoved).toHaveBeenCalledWith(removed);
  });

  it('retains classified lifecycle failure', async () => {
    const lifecycle = createProjectLifecycleAdapter(
      bridge({
        prepareFolderRemoval: vi.fn(async () => ({
          failure: { kind: 'unauthorized' as const, message: 'Window retired.' },
          ok: false as const,
        })),
      }),
    );

    await expect(lifecycle.prepareFolderRemoval('/project/notes')).rejects.toEqual(
      new ProjectError('unauthorized', 'Window retired.'),
    );
  });

  it('asks the desktop for the initial folder once and answers the same folder after', async () => {
    const native = bridge({
      claimInitialFolder: vi.fn(async () => ({
        folderPath: '/project/Notes' as string | null,
        ok: true as const,
      })),
    });
    const lifecycle = createProjectLifecycleAdapter(native);

    // The desktop answers once and then forgets, so a second ask must not read
    // that forgetting as "this window was created for no folder".
    await expect(lifecycle.claimInitialFolder()).resolves.toBe('/project/Notes');
    await expect(lifecycle.claimInitialFolder()).resolves.toBe('/project/Notes');
    expect(native.claimInitialFolder).toHaveBeenCalledOnce();
  });

  it('reads a refused claim as a window with no folder named for it', async () => {
    // Unlike the other lifecycle calls this does not raise. There is no
    // recovery to offer and nothing to tell the reader: the window still works,
    // it just lands wherever it would have landed anyway.
    const lifecycle = createProjectLifecycleAdapter(
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
