import { describe, expect, it, vi } from 'vite-plus/test';

import { AgentContextError } from '@/features/agent/application/ports';
import type { HttpClient } from '@/platform/http/client';

import { createAgentContextApi } from './context-api';

const origin = 'http://127.0.0.1:43123';
const source = { folderPath: '/Library/Research', path: 'papers/report.pdf' };

function client(body: unknown, status = 200): HttpClient {
  return { request: vi.fn(async () => ({ body, status })) };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return error instanceof AgentContextError ? error.kind : 'other';
  }
}

describe('Agent context API', () => {
  it('resolves a derived source through the JSON client', async () => {
    const http = client({
      available: true,
      folder: 'Research',
      kind: 'derived',
      path: '/Library/Research/papers/report.pdf',
      readPath: '/app-data/derived/report.md',
      reason: '',
      sourceFormat: 'pdf',
      sourcePath: 'papers/report.pdf',
    });
    const api = createAgentContextApi(http, origin);
    const resolved = await api.resolve(source, new AbortController().signal);
    expect(resolved).toMatchObject({ kind: 'derived', readPath: '/app-data/derived/report.md' });
    const request = vi.mocked(http.request).mock.calls[0]?.[0];
    expect(request?.path).toBe(
      `/api/library/agent-context-file?${new URLSearchParams({ path: '/Library/Research/papers/report.pdf' })}`,
    );
  });

  it('maps a missing file, an unsupported format, and an invalid body', async () => {
    const signal = new AbortController().signal;
    expect(
      await kindOf(
        createAgentContextApi(client({ error: 'not found' }, 404), origin).resolve(source, signal),
      ),
    ).toBe('not-found');
    expect(
      await kindOf(
        createAgentContextApi(client({ error: 'unsupported format' }, 415), origin).resolve(
          source,
          signal,
        ),
      ),
    ).toBe('unsupported');
    expect(
      await kindOf(createAgentContextApi(client({ path: 1 }), origin).resolve(source, signal)),
    ).toBe('invalid-response');
  });

  it('uploads transient files as multipart to the server origin', async () => {
    const fetchRequest = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        files: [
          { name: 'shot.png', path: '/tmp/stashbase-attachments/1/shot.png' },
          { error: 'write failed', name: 'big.bin' },
        ],
      }),
    );
    const api = createAgentContextApi(client(null), origin, fetchRequest);
    const outcomes = await api.upload(
      [new File(['png'], 'shot.png', { type: 'image/png' }), new File(['x'], 'big.bin')],
      new AbortController().signal,
    );
    expect(outcomes).toEqual([
      { name: 'shot.png', path: '/tmp/stashbase-attachments/1/shot.png' },
      { error: 'write failed', name: 'big.bin' },
    ]);
    const [url, init] = fetchRequest.mock.calls[0]!;
    expect(String(url)).toBe(`${origin}/api/agent/attach`);
    expect(init?.method).toBe('POST');
    const form = init?.body as FormData;
    expect(form.getAll('files').map((entry) => (entry as File).name)).toEqual([
      'shot.png',
      'big.bin',
    ]);
  });

  it('maps a failed upload to unavailable with the server message', async () => {
    const api = createAgentContextApi(
      client(null),
      origin,
      vi.fn(async () => jsonResponse({ error: 'could not secure attachment storage' }, 500)),
    );
    const promise = api.upload([new File(['x'], 'a.txt')], new AbortController().signal);
    await expect(promise).rejects.toMatchObject({
      kind: 'unavailable',
      message: 'could not secure attachment storage',
    });
  });
});
