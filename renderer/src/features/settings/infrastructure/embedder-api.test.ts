import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createEmbedderApi } from './embedder-api';

const signal = new AbortController().signal;
const state = {
  account: { active: false, signedIn: false },
  authorized: false,
  hasKey: false,
  model: 'text-embedding-3-small',
  provider: 'openai',
  source: 'openai',
};

describe('embedder API', () => {
  it('loads the embedder state and saves a key with its provider', async () => {
    const request = vi.fn(async (input: { path: string }) =>
      input.path === '/api/embedder'
        ? { body: state, status: 200 }
        : {
            body: {
              authorized: true,
              hasKey: true,
              model: 'm',
              provider: 'openai',
              source: 'openai',
              warning: 'offline',
            },
            status: 200,
          },
    );
    const api = createEmbedderApi({ request } as HttpClient);
    expect((await api.load(signal)).authorized).toBe(false);
    const saved = await api.saveKey('openai', 'sk-test', signal);
    expect(saved.warning).toBe('offline');
    expect(request).toHaveBeenLastCalledWith({
      body: { key: 'sk-test', provider: 'openai' },
      method: 'PUT',
      path: '/api/embedder/key',
      signal,
    });
  });

  it('surfaces a provider rejection with the server message', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({ body: { error: 'Invalid API key.' }, status: 401 })),
    };
    await expect(createEmbedderApi(client).saveKey('openai', 'bad', signal)).rejects.toMatchObject({
      kind: 'rejected',
      message: 'Invalid API key.',
    });
  });

  it('starts an embedding-purpose sign-in and reads its status', async () => {
    const request = vi.fn(async (input: { path: string }) =>
      input.path === '/api/account/oauth/start'
        ? {
            body: {
              flowId: 'f1',
              provider: 'google',
              purpose: 'embedding',
              url: 'https://accounts.example/x',
            },
            status: 200,
          }
        : { body: { state: 'complete' }, status: 200 },
    );
    const api = createEmbedderApi({ request } as HttpClient);
    const started = await api.startSignIn(signal);
    expect(started.url).toBe('https://accounts.example/x');
    expect(request).toHaveBeenCalledWith({
      body: { provider: 'google', purpose: 'embedding' },
      method: 'POST',
      path: '/api/account/oauth/start',
      signal,
    });
    expect((await api.signInStatus('f1', signal)).state).toBe('complete');
  });
});
