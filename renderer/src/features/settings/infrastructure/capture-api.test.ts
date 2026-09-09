import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createCaptureAdapter } from './capture-api';

const signal = new AbortController().signal;

describe('capture API', () => {
  it('reads and writes the opt-in through the capture route', async () => {
    const request = vi.fn(async () => ({ body: { clipboardImageImport: true }, status: 200 }));
    const api = createCaptureAdapter({ request });
    await expect(api.update({ clipboardImageImport: true }, signal)).resolves.toEqual({
      clipboardImageImport: true,
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { clipboardImageImport: true },
        method: 'PUT',
        path: '/api/capture',
      }),
    );
  });

  it('classifies an unreadable setting as unavailable', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    await expect(createCaptureAdapter(client).load(signal)).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });
});
