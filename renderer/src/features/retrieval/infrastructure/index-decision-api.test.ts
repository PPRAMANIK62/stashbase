import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createIndexDecisionAdapter } from './index-decision-api';

const signal = new AbortController().signal;

describe('index decision API', () => {
  it('posts a folder-explicit start decision and accepts the accepted status', async () => {
    const request = vi.fn(async () => ({ body: { ok: true }, status: 202 }));
    await createIndexDecisionAdapter({ request }).decide('/library/research', 'start', signal);
    expect(request).toHaveBeenCalledWith({
      body: { decision: 'start', folder: '/library/research' },
      method: 'POST',
      path: '/api/semantic-indexing/decision',
      signal,
    });
  });

  it('dismisses a warning and resyncs the folder', async () => {
    const request = vi.fn(async () => ({ body: { ok: true, added: [] }, status: 200 }));
    const api = createIndexDecisionAdapter({ request });
    await api.dismissWarning('/library/research', signal);
    await api.resync('/library/research', signal);
    expect(request).toHaveBeenNthCalledWith(1, {
      body: { folder: '/library/research' },
      method: 'POST',
      path: '/api/index-warning/dismiss',
      signal,
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      body: undefined,
      method: 'POST',
      path: '/api/sync?folder=%2Flibrary%2Fresearch',
      signal,
    });
  });

  it('surfaces the server reason on failure', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({ body: { error: 'daemon busy' }, status: 500 })),
    };
    await expect(
      createIndexDecisionAdapter(client).decide('/library/research', 'defer', signal),
    ).rejects.toMatchObject({ kind: 'unavailable', message: 'Preparation could not be deferred.' });
  });
});
