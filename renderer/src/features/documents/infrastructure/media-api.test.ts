import { describe, expect, it, vi } from 'vite-plus/test';

import { MediaError } from '@/features/documents/application/ports';
import type { HttpClient } from '@/platform/http/client';

import { createMediaAdapter } from './media-api';

const source = { folderPath: '/library/research calls', path: 'weekly/demo #1.mp4' };

function readyTranscript() {
  return {
    status: 'ready',
    transcript: {
      createdAt: '2026-09-04T08:00:00.000Z',
      language: 'en',
      provider: { id: 'local', model: 'small', version: '1' },
      schemaVersion: 1,
      segments: [{ endMs: 2_500, id: 0, startMs: 1_000, text: 'First result' }],
      source: {
        contentHash: 'a'.repeat(64),
        durationMs: 60_000,
        mtimeMs: 1,
        size: 20,
        statIdentity: 'stat:source',
      },
    },
  };
}

describe('media API', () => {
  it('loads and maps a folder-scoped timestamped transcript', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({ body: readyTranscript(), status: 200 })),
    };
    const api = createMediaAdapter(client);
    const signal = new AbortController().signal;

    await expect(api.loadTranscript(source, signal)).resolves.toEqual({
      status: 'ready',
      transcript: {
        durationMs: 60_000,
        language: 'en',
        model: 'small',
        segments: [{ endMs: 2_500, id: 0, startMs: 1_000, text: 'First result' }],
      },
    });
    expect(client.request).toHaveBeenCalledWith({
      path: '/api/audio/transcript?folder=%2Flibrary%2Fresearch+calls&path=weekly%2Fdemo+%231.mp4',
      signal,
    });
  });

  it('prepares and polls a compatible preview through explicit-folder requests', async () => {
    const client: HttpClient = {
      request: vi
        .fn<HttpClient['request']>()
        .mockResolvedValueOnce({ body: { ok: true }, status: 200 })
        .mockResolvedValueOnce({
          body: { completedMs: 1_000, percent: 25, status: 'converting', totalMs: 4_000 },
          status: 200,
        }),
    };
    const api = createMediaAdapter(client);
    const signal = new AbortController().signal;

    await expect(api.preparePreview(source, signal)).resolves.toBeUndefined();
    await expect(api.loadPreviewStatus(source, signal)).resolves.toEqual({
      completedMs: 1_000,
      percent: 25,
      status: 'converting',
      totalMs: 4_000,
    });
    expect(client.request).toHaveBeenNthCalledWith(1, {
      body: { folder: '/library/research calls', path: 'weekly/demo #1.mp4' },
      method: 'POST',
      path: '/api/audio/preview/prepare',
      signal,
    });
  });

  it('retries and cancels transcript work without exposing server failure detail', async () => {
    const client: HttpClient = {
      request: vi
        .fn<HttpClient['request']>()
        .mockResolvedValueOnce({ body: { mode: 'conversion', ok: true }, status: 200 })
        .mockResolvedValueOnce({ body: { cancelled: true, ok: true }, status: 200 }),
    };
    const api = createMediaAdapter(client);
    const signal = new AbortController().signal;

    await expect(api.reprocessTranscript(source, signal)).resolves.toBeUndefined();
    await expect(api.cancelTranscript(source, signal)).resolves.toBe(true);
    expect(client.request).toHaveBeenNthCalledWith(2, {
      body: { folder: '/library/research calls', path: 'weekly/demo #1.mp4' },
      method: 'POST',
      path: '/api/files/cancel-preparation',
      signal,
    });
  });

  it('rejects malformed responses and stale folder scope', async () => {
    const malformed = createMediaAdapter({
      request: vi.fn(async () => ({ body: { status: 'ready', transcript: {} }, status: 200 })),
    });
    await expect(
      malformed.loadTranscript(source, new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'invalid-response' } satisfies Partial<MediaError>);

    const stale = createMediaAdapter({
      request: vi.fn(async () => ({ body: { error: '/private/path missing' }, status: 410 })),
    });
    await expect(stale.loadTranscript(source, new AbortController().signal)).rejects.toMatchObject({
      kind: 'scope-lost',
      message: 'The media folder is no longer available in this window.',
    });
  });

  it('rejects non-media sources before transport', async () => {
    const client: HttpClient = { request: vi.fn() };
    const api = createMediaAdapter(client);

    await expect(
      api.loadTranscript(
        { folderPath: '/library', path: 'notes.md' },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ kind: 'unavailable' });
    expect(client.request).not.toHaveBeenCalled();
  });
});
