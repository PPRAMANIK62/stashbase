import { describe, expect, it, vi } from 'vite-plus/test';

import { openFolder } from './open-folder';
import { LibraryError } from './ports';

const snapshot = {
  activeFolder: { name: 'Notes', path: '/library/notes' },
  homeDirectory: '/library',
  members: [],
};

describe('open library folder', () => {
  it('returns the authoritative snapshot', async () => {
    const api = { load: vi.fn(), openFolder: vi.fn(async () => snapshot) };

    await expect(openFolder(api, '/library/notes', new AbortController().signal)).resolves.toEqual({
      status: 'opened',
      snapshot,
    });
  });

  it('keeps a classified failure local to the operation', async () => {
    const api = {
      load: vi.fn(),
      openFolder: vi.fn(async () => {
        throw new LibraryError('unavailable', 'The library is unavailable.');
      }),
    };

    await expect(openFolder(api, '/library/notes', new AbortController().signal)).resolves.toEqual({
      status: 'failed',
      message: 'The library is unavailable.',
    });
  });

  it('rejects a completion that arrives after its operation was cancelled', async () => {
    let resolveOpen: ((value: typeof snapshot) => void) | undefined;
    const controller = new AbortController();
    const api = {
      load: vi.fn(),
      openFolder: vi.fn(
        () =>
          new Promise<typeof snapshot>((resolve) => {
            resolveOpen = resolve;
          }),
      ),
    };
    const result = openFolder(api, '/library/notes', controller.signal);

    controller.abort();
    resolveOpen?.(snapshot);

    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });
});
