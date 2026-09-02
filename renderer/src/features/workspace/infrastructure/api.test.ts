import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createLibraryApi } from './api';

describe('library API', () => {
  it('validates and maps library snapshots', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({
        body: {
          current: { name: 'Notes', path: '/library/notes' },
          homeDir: '/library',
          recent: [
            { favorite: true, openedAt: '2026-08-31T12:00:00.000Z', path: '/library/notes' },
          ],
        },
        status: 200,
      })),
    };
    const api = createLibraryApi(client);
    await expect(api.load(new AbortController().signal)).resolves.toEqual({
      activeFolder: { name: 'Notes', path: '/library/notes' },
      homeDirectory: '/library',
      members: [{ favorite: true, openedAt: '2026-08-31T12:00:00.000Z', path: '/library/notes' }],
    });
  });

  it('rejects malformed success and classifies unavailable responses', async () => {
    const malformed = createLibraryApi({
      request: vi.fn(async () => ({ body: { current: 'wrong' }, status: 200 })),
    });
    await expect(malformed.load(new AbortController().signal)).rejects.toMatchObject({
      kind: 'invalid-response',
    });

    const unavailable = createLibraryApi({
      request: vi.fn(async () => ({
        body: { code: 'FOLDER_MISSING', error: 'private path detail' },
        status: 400,
      })),
    });
    await expect(
      unavailable.openFolder('/library/missing', new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'unavailable', message: 'The library is unavailable.' });
  });

  it('posts validated removal and maps its authoritative snapshot', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({
        body: { current: null, homeDir: '/library', recent: [] },
        status: 200,
      })),
    };
    const signal = new AbortController().signal;

    await expect(createLibraryApi(client).removeFolder('/library/notes', signal)).resolves.toEqual({
      activeFolder: null,
      homeDirectory: '/library',
      members: [],
    });
    expect(client.request).toHaveBeenCalledWith({
      body: { path: '/library/notes' },
      method: 'POST',
      path: '/api/library/folders/remove',
      signal,
    });
  });
});
