import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createAppearanceAdapter } from './appearance-api';

const signal = new AbortController().signal;

const TRIPLE = { readingTextSize: 'default', theme: 'dark', uiScale: 'default' } as const;

describe('appearance API', () => {
  it('reads the triple through the appearance route', async () => {
    const request = vi.fn(async () => ({ body: TRIPLE, status: 200 }));
    await expect(createAppearanceAdapter({ request }).load(signal)).resolves.toEqual({
      readingTextSize: 'default',
      theme: 'dark',
      uiScale: 'default',
    });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/api/appearance' }));
  });

  it('writes one row at a time and answers with the whole triple', async () => {
    const request = vi.fn(async () => ({ body: TRIPLE, status: 200 }));
    const api = createAppearanceAdapter({ request });
    await expect(api.update({ theme: 'dark' }, signal)).resolves.toEqual({
      readingTextSize: 'default',
      theme: 'dark',
      uiScale: 'default',
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { theme: 'dark' },
        method: 'PUT',
        path: '/api/appearance',
      }),
    );
  });

  it('classifies an unreadable setting as unavailable', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    await expect(createAppearanceAdapter(client).load(signal)).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });
});
