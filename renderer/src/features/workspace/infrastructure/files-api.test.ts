import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';
import { listing, listingFile } from '@/test/fakes/workspace';

import { createFilesAdapter } from './files-api';

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
          showHiddenFiles: false,
        },
        status: 200,
      })),
    };
    const signal = new AbortController().signal;

    await expect(createFilesAdapter(client).load('/library/research', signal)).resolves.toEqual(
      listing(
        [
          listingFile({
            heading: 'Plan',
            importedAt: '2026-09-01T00:00:00.000Z',
            path: 'notes/plan.md',
            size: 42,
            snippet: 'First step',
          }),
        ],
        ['notes'],
      ),
    );
    expect(client.request).toHaveBeenCalledWith({
      path: '/api/files?folder=%2Flibrary%2Fresearch',
      signal,
    });
  });

  it('rejects malformed success responses at the adapter boundary', async () => {
    const api = createFilesAdapter({
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

    await createFilesAdapter(client).reveal('/library/notes', 'drafts/a #1.md', signal);

    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/reveal/drafts/a%20%231.md?folder=%2Flibrary%2Fnotes',
      signal,
    });
  });

  it('rejects an invalid reveal identity before transport', async () => {
    const client: HttpClient = { request: vi.fn() };

    await expect(
      createFilesAdapter(client).reveal('', 'drafts/plan.md', new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'unavailable', message: 'The item identity is invalid.' });
    expect(client.request).not.toHaveBeenCalled();
  });

  it('classifies a cleared window context as scope loss', async () => {
    const api = createFilesAdapter({
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

  it('creates files and folders inside the explicit folder and settles on the server path', async () => {
    const client: HttpClient = {
      request: vi
        .fn()
        .mockResolvedValueOnce({ body: { content: '', name: 'drafts/Plan.md' }, status: 200 })
        .mockResolvedValueOnce({ body: { path: 'drafts/archive' }, status: 200 }),
    };
    const signal = new AbortController().signal;
    const api = createFilesAdapter(client);

    await expect(
      api.createEntry('/library/notes', 'file', 'drafts', 'Plan', signal),
    ).resolves.toEqual({ path: 'drafts/Plan.md' });
    expect(client.request).toHaveBeenNthCalledWith(1, {
      body: { dir: 'drafts', name: 'Plan' },
      method: 'POST',
      path: '/api/files?folder=%2Flibrary%2Fnotes',
      signal,
    });
    await expect(
      api.createEntry('/library/notes', 'folder', 'drafts', 'archive', signal),
    ).resolves.toEqual({ path: 'drafts/archive' });
    expect(client.request).toHaveBeenNthCalledWith(2, {
      body: { path: 'drafts/archive' },
      method: 'POST',
      path: '/api/folders?folder=%2Flibrary%2Fnotes',
      signal,
    });
    await expect(
      api.createEntry('/library/notes', 'file', '', 'a/b', signal),
    ).rejects.toMatchObject({ kind: 'rejected' });
    expect(client.request).toHaveBeenCalledTimes(2);
  });

  it('renames and deletes entries by kind and classifies refusals', async () => {
    const client: HttpClient = {
      request: vi
        .fn()
        .mockResolvedValueOnce({
          body: { linksUpdated: 1, name: 'drafts/Outline.md' },
          status: 200,
        })
        .mockResolvedValueOnce({ body: { path: 'archive' }, status: 200 })
        .mockResolvedValueOnce({ body: { alreadyGone: false }, status: 200 })
        .mockResolvedValueOnce({ body: { error: 'target already exists' }, status: 409 })
        .mockResolvedValueOnce({ body: { code: 'FOLDER_CHANGED', error: 'stale' }, status: 409 })
        .mockResolvedValueOnce({ body: { error: 'new_name required' }, status: 400 }),
    };
    const signal = new AbortController().signal;
    const api = createFilesAdapter(client);

    await expect(
      api.renameEntry(
        '/library/notes',
        { kind: 'file', path: 'drafts/a #1.md' },
        'Outline',
        signal,
      ),
    ).resolves.toEqual({ path: 'drafts/Outline.md' });
    expect(client.request).toHaveBeenNthCalledWith(1, {
      body: { new_name: 'Outline' },
      method: 'PATCH',
      path: '/api/files/drafts/a%20%231.md?folder=%2Flibrary%2Fnotes',
      signal,
    });
    await expect(
      api.renameEntry('/library/notes', { kind: 'folder', path: 'drafts' }, 'archive', signal),
    ).resolves.toEqual({ path: 'archive' });
    expect(client.request).toHaveBeenNthCalledWith(2, {
      body: { new_name: 'archive' },
      method: 'PATCH',
      path: '/api/folders/drafts?folder=%2Flibrary%2Fnotes',
      signal,
    });
    await expect(
      api.deleteEntry('/library/notes', { kind: 'folder', path: 'archive' }, signal),
    ).resolves.toBeUndefined();
    expect(client.request).toHaveBeenNthCalledWith(3, {
      method: 'DELETE',
      path: '/api/folders/archive?folder=%2Flibrary%2Fnotes',
      signal,
    });
    await expect(
      api.renameEntry('/library/notes', { kind: 'file', path: 'a.md' }, 'b', signal),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message: 'Something with that name already exists.',
    });
    await expect(
      api.deleteEntry('/library/notes', { kind: 'file', path: 'a.md' }, signal),
    ).rejects.toMatchObject({ kind: 'scope-lost' });
    await expect(
      api.renameEntry('/library/notes', { kind: 'file', path: 'a.md' }, 'b', signal),
    ).rejects.toMatchObject({ kind: 'rejected' });
  });
});
