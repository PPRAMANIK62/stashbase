import { describe, expect, it, vi } from 'vite-plus/test';

import {
  libraryApi as api,
  libraryLifecycle as lifecycle,
  librarySnapshot,
} from '@/test/fakes/workspace';

import { libraryFailureMessage } from './failure-messages';
import { LibraryError } from './ports';
import { removeFolder } from './remove-folder';

/** What the fake library reports after an authoritative removal. */
const removed = librarySnapshot({ activeFolder: null, members: [] });

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
        throw new LibraryError('unavailable', 'HTTP 503 from /api/library');
      }),
    });
    await expect(
      removeFolder(failedApi, lifecycle(), '/library/notes', new AbortController().signal),
    ).resolves.toEqual({
      status: 'failed',
      message: libraryFailureMessage('unavailable', 'removed'),
    });

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
