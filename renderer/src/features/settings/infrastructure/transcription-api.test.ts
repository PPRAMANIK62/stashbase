import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient, HttpRequest } from '@/platform/http/client';

import { createTranscriptionAdapter } from './transcription-api';

const signal = new AbortController().signal;

describe('transcription API', () => {
  it('loads validated settings and maps the download operation', async () => {
    const request = vi.fn(async ({ path }: HttpRequest) =>
      path.endsWith('/download')
        ? { body: { download: { status: 'verifying' }, id: 'base' }, status: 202 }
        : {
            body: { language: 'auto', modelId: 'base', providerId: 'local', providers: [] },
            status: 200,
          },
    );
    const api = createTranscriptionAdapter({ request });
    await expect(api.load(signal)).resolves.toMatchObject({ modelId: 'base' });
    await expect(api.downloadModel('base', signal)).resolves.toEqual({ status: 'verifying' });
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ method: 'POST', path: '/api/transcription/models/base/download' }),
    );
  });

  it('surfaces the server reason for a rejected preference', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({
        body: { error: 'transcription model id is required when changing provider' },
        status: 400,
      })),
    };
    await expect(
      createTranscriptionAdapter(client).updatePreferences({ providerId: 'remote' }, signal),
    ).rejects.toMatchObject({
      kind: 'invalid-request',
      message: 'transcription model id is required when changing provider',
    });
  });
});
