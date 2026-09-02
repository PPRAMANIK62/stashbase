import { describe, expect, it, vi } from 'vite-plus/test';

import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { LibraryError, type LibraryApi, type LibraryLifecycle } from './ports';
import { removeFolder } from './remove-folder';

const removed: LibrarySnapshot = {
  activeFolder: null,
  homeDirectory: '/library',
  members: [],
};

function api(overrides: Partial<LibraryApi> = {}): LibraryApi {
  return {
    load: vi.fn(),
    openFolder: vi.fn(),
    removeFolder: vi.fn(async () => removed),
    ...overrides,
  };
}

function lifecycle(overrides: Partial<LibraryLifecycle> = {}): LibraryLifecycle {
  return {
    notifyFolderRemoved: vi.fn(async () => undefined),
    onFolderRemoved: vi.fn(() => () => undefined),
    onPrepareFolderRemoval: vi.fn(() => () => undefined),
    prepareFolderRemoval: vi.fn(async () => true),
    setActiveFolder: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('remove library folder', () => {
  it('crosses window release before the authoritative removal and notification', async () => {
    const calls: string[] = [];
    const library = api({
      removeFolder: vi.fn(async () => {
        calls.push('remove');
        return removed;
      }),
    });
    const native = lifecycle({
      prepareFolderRemoval: vi.fn(async () => {
        calls.push('prepare');
        return true;
      }),
      notifyFolderRemoved: vi.fn(async () => {
        calls.push('notify');
      }),
    });

    await expect(
      removeFolder(library, native, '/library/notes', new AbortController().signal),
    ).resolves.toEqual({ status: 'removed', snapshot: removed, warning: null });
    expect(calls).toEqual(['prepare', 'remove', 'notify']);
  });

  it('does not remove when an affected window cannot release the folder', async () => {
    const library = api();
    const native = lifecycle({ prepareFolderRemoval: vi.fn(async () => false) });

    await expect(
      removeFolder(library, native, '/library/notes', new AbortController().signal),
    ).resolves.toEqual({
      status: 'failed',
      message: 'A window could not release this folder. Resolve its save error and try again.',
    });
    expect(library.removeFolder).not.toHaveBeenCalled();
  });

  it('keeps classified server failure local and reports notification lag after commit', async () => {
    const failedApi = api({
      removeFolder: vi.fn(async () => {
        throw new LibraryError('unavailable', 'Removal is unavailable.');
      }),
    });
    await expect(
      removeFolder(failedApi, lifecycle(), '/library/notes', new AbortController().signal),
    ).resolves.toEqual({ status: 'failed', message: 'Removal is unavailable.' });

    await expect(
      removeFolder(
        api(),
        lifecycle({ notifyFolderRemoved: vi.fn(async () => Promise.reject(new Error('ipc'))) }),
        '/library/notes',
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      status: 'removed',
      snapshot: removed,
      warning: 'The folder was removed. Another window may take a moment to refresh.',
    });
  });
});
