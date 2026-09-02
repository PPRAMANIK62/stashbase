import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createFilesApi } from './files-api';

describe('files API', () => {
  it('requests the explicit folder and maps validated defaults', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({
        body: {
          files: [
            {
              format: 'md',
              heading: 'Plan',
              imported_at: '2026-09-01T00:00:00.000Z',
              name: 'notes/plan.md',
              size: 42,
              snippet: 'First step',
            },
          ],
          folder: 'Research',
          folders: [{ path: 'notes' }],
        },
        status: 200,
      })),
    };
    const signal = new AbortController().signal;

    await expect(createFilesApi(client).load('/library/research', signal)).resolves.toEqual({
      files: [
        {
          availability: 'available',
          format: 'md',
          heading: 'Plan',
          importedAt: '2026-09-01T00:00:00.000Z',
          kind: 'regular',
          path: 'notes/plan.md',
          size: 42,
          snippet: 'First step',
        },
      ],
      folderName: 'Research',
      folders: [{ kind: 'normal', path: 'notes' }],
    });
    expect(client.request).toHaveBeenCalledWith({
      path: '/api/files?folder=%2Flibrary%2Fresearch',
      signal,
    });
  });

  it('rejects malformed success responses at the adapter boundary', async () => {
    const api = createFilesApi({
      request: vi.fn(async () => ({ body: { files: [], folder: 'Notes' }, status: 200 })),
    });

    await expect(api.load('/library/notes', new AbortController().signal)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('encodes each reveal path segment and validates the response', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({ body: {}, status: 200 })),
    };
    const signal = new AbortController().signal;

    await createFilesApi(client).reveal('drafts/a #1.md', signal);

    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/reveal/drafts/a%20%231.md',
      signal,
    });
  });

  it('classifies a cleared window context as scope loss', async () => {
    const api = createFilesApi({
      request: vi.fn(async () => ({
        body: { code: 'NO_FOLDER', error: 'no folder open' },
        status: 412,
      })),
    });

    await expect(api.load('/library/notes', new AbortController().signal)).rejects.toMatchObject({
      kind: 'scope-lost',
      message: 'This folder is no longer available in this window.',
    });
  });
});
