import { describe, expect, it, vi } from 'vite-plus/test';

import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import { libraryApi, librarySnapshot } from '@/test/fakes/workspace';

import { libraryFailureMessage } from './failure-messages';
import { openFolder } from './open-folder';
import { LibraryError } from './ports';

const snapshot = librarySnapshot({
  activeFolder: { name: 'Notes', path: '/library/notes' },
  homeDirectory: '/library',
  members: [],
});

describe('open library folder', () => {
  it('returns the authoritative snapshot', async () => {
    const api = libraryApi({ openFolder: vi.fn(async () => snapshot) });

    await expect(openFolder(api, '/library/notes', new AbortController().signal)).resolves.toEqual({
      status: 'opened',
      snapshot,
    });
  });

  it('keeps a classified failure local to the operation', async () => {
    const api = libraryApi({
      openFolder: vi.fn(async () => {
        throw new LibraryError('unavailable', 'HTTP 503 from /api/library');
      }),
    });

    await expect(openFolder(api, '/library/notes', new AbortController().signal)).resolves.toEqual({
      status: 'failed',
      message: libraryFailureMessage('unavailable', 'opened'),
    });
  });

  it('rejects a completion that arrives after its operation was cancelled', async () => {
    let resolveOpen: ((value: LibrarySnapshot) => void) | undefined;
    const controller = new AbortController();
    const api = libraryApi({
      openFolder: vi.fn(
        () =>
          new Promise<LibrarySnapshot>((resolve) => {
            resolveOpen = resolve;
          }),
      ),
    });
    const result = openFolder(api, '/library/notes', controller.signal);

    controller.abort();
    resolveOpen?.(snapshot);

    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });
});
