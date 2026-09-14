import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createIndexDecisionAdapter } from './index-decision-api';

const signal = new AbortController().signal;

describe('index decision API', () => {
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
      createIndexDecisionAdapter(client).resync('/library/research', signal),
    ).rejects.toMatchObject({ kind: 'unavailable', message: 'Sync could not start.' });
  });
});
