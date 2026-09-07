import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createAgentRuntimeApi } from './agent-runtime-api';

const catalogBody = {
  clis: [
    {
      id: 'stashbase',
      label: 'Built-in',
      vendor: 'StashBase',
      installHint: '',
      installed: true,
      source: 'bundled',
      bootstrap: { phase: 'ready' },
      launchCommand: 'stashbase',
    },
  ],
  debug: { enabled: false, discoveryPolicy: 'auto', nextFailure: 'none', nextTurnFailure: 'none' },
};

describe('agent runtime API', () => {
  it('lists the catalog and maps a well-formed response', async () => {
    const client: HttpClient = { request: vi.fn(async () => ({ body: catalogBody, status: 200 })) };
    const signal = new AbortController().signal;

    await expect(createAgentRuntimeApi(client).listAgents(signal)).resolves.toMatchObject({
      clis: [{ id: 'stashbase', installed: true }],
    });
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/terminal/clis',
      signal,
    });
  });

  it('prepares an agent with the requested action', async () => {
    const client: HttpClient = { request: vi.fn(async () => ({ body: catalogBody, status: 200 })) };
    const signal = new AbortController().signal;

    await createAgentRuntimeApi(client).prepareAgent('codex', 'bootstrap', signal);

    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/terminal/clis/codex/bootstrap',
      signal,
    });
  });

  it('sends a validated debug patch over PUT', async () => {
    const client: HttpClient = { request: vi.fn(async () => ({ body: catalogBody, status: 200 })) };
    const signal = new AbortController().signal;

    await createAgentRuntimeApi(client).updateDebug({ discoveryPolicy: 'managed-only' }, signal);

    expect(client.request).toHaveBeenCalledWith({
      body: { discoveryPolicy: 'managed-only' },
      method: 'PUT',
      path: '/api/terminal/debug',
      signal,
    });
  });

  it('removes a managed runtime over DELETE', async () => {
    const client: HttpClient = { request: vi.fn(async () => ({ body: catalogBody, status: 200 })) };
    const signal = new AbortController().signal;

    await createAgentRuntimeApi(client).resetManagedAgent('codex', signal);

    expect(client.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/api/terminal/clis/codex/managed',
      signal,
    });
  });

  it('fetches the allowance', async () => {
    const allowance = {
      profile: 'stashbase-agent-default',
      remainingPercent: 62,
      inputTokens: 128_402,
      outputTokens: 41_208,
      cacheReadTokens: 9_014,
      windowStartedAt: '2026-09-01T00:00:00.000Z',
      windowEndsAt: '2026-09-08T00:00:00.000Z',
    };
    const client: HttpClient = { request: vi.fn(async () => ({ body: allowance, status: 200 })) };

    await expect(
      createAgentRuntimeApi(client).getAllowance(new AbortController().signal),
    ).resolves.toEqual(allowance);
  });

  it('rejects malformed success and sanitizes server failures', async () => {
    const malformed = createAgentRuntimeApi({
      request: vi.fn(async () => ({ body: { clis: 'wrong' }, status: 200 })),
    });
    await expect(malformed.listAgents(new AbortController().signal)).rejects.toMatchObject({
      kind: 'invalid-response',
    });

    const unavailable = createAgentRuntimeApi({
      request: vi.fn(async () => ({ body: { error: 'private filesystem detail' }, status: 500 })),
    });
    await expect(unavailable.listAgents(new AbortController().signal)).rejects.toMatchObject({
      kind: 'unavailable',
      message: 'Agent runtimes are unavailable.',
    });
  });
});
