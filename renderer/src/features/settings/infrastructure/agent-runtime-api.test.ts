import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createAgentRuntimeAdapter } from './agent-runtime-api';

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
  debug: { enabled: true, discoveryPolicy: 'auto', nextFailure: 'none', nextTurnFailure: 'none' },
};

describe('agent runtime API', () => {
  it('lists the catalog and maps a well-formed response', async () => {
    const client: HttpClient = { request: vi.fn(async () => ({ body: catalogBody, status: 200 })) };
    const signal = new AbortController().signal;

    await expect(createAgentRuntimeAdapter(client).listAgents(signal)).resolves.toEqual({
      runtimes: [
        {
          id: 'stashbase',
          installed: true,
          label: 'Built-in',
          ownership: 'bundled',
          preparation: { kind: 'ready' },
        },
      ],
      debug: { discoverySource: 'auto', nextSetupResult: 'none', nextTurnResult: 'none' },
    });
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/terminal/clis',
      signal,
    });
  });

  it('reads debug controls the server disabled as no controls at all', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({
        body: { ...catalogBody, debug: { ...catalogBody.debug, enabled: false } },
        status: 200,
      })),
    };

    await expect(
      createAgentRuntimeAdapter(client).listAgents(new AbortController().signal),
    ).resolves.toMatchObject({ debug: null });
  });

  it('prepares an agent with the requested action', async () => {
    const client: HttpClient = { request: vi.fn(async () => ({ body: catalogBody, status: 200 })) };
    const signal = new AbortController().signal;

    await createAgentRuntimeAdapter(client).prepareAgent('codex', 'bootstrap', signal);

    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/terminal/clis/codex/bootstrap',
      signal,
    });
  });

  it('sends a validated debug patch over PUT', async () => {
    const client: HttpClient = { request: vi.fn(async () => ({ body: catalogBody, status: 200 })) };
    const signal = new AbortController().signal;

    await createAgentRuntimeAdapter(client).updateDebug(
      { discoverySource: 'managed-only' },
      signal,
    );

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

    await createAgentRuntimeAdapter(client).resetManagedAgent('codex', signal);

    expect(client.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/api/terminal/clis/codex/managed',
      signal,
    });
  });

  it('fetches the allowance and drops the fields no reader has', async () => {
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
      createAgentRuntimeAdapter(client).getAllowance(new AbortController().signal),
    ).resolves.toEqual({
      cacheReadTokens: 9_014,
      inputTokens: 128_402,
      outputTokens: 41_208,
      remainingPercent: 62,
      windowEndsAt: '2026-09-08T00:00:00.000Z',
    });
  });

  it('rejects malformed success and sanitizes server failures', async () => {
    const malformed = createAgentRuntimeAdapter({
      request: vi.fn(async () => ({ body: { clis: 'wrong' }, status: 200 })),
    });
    await expect(malformed.listAgents(new AbortController().signal)).rejects.toMatchObject({
      kind: 'invalid-response',
    });

    const unavailable = createAgentRuntimeAdapter({
      request: vi.fn(async () => ({ body: { error: 'private filesystem detail' }, status: 500 })),
    });
    await expect(unavailable.listAgents(new AbortController().signal)).rejects.toMatchObject({
      kind: 'unavailable',
      message: 'Agent runtimes are unavailable.',
    });
  });
});
