import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiError,
  encodePath,
  getWindowId,
  parseJsonOrThrow,
  requestHeaders,
  sendWithNetworkRetry,
} from '@/common/api/apiTransport';

test('encodePath preserves separators while encoding individual segments', () => {
  assert.equal(encodePath('notes/a b#c.md'), 'notes/a%20b%23c.md');
  assert.equal(
    encodePath('\u4e2d\u6587/\u8ba1\u5212.md'),
    '%E4%B8%AD%E6%96%87/%E8%AE%A1%E5%88%92.md',
  );
});

test('window identity falls back to web outside a browser session', () => {
  assert.equal(getWindowId(), 'web');
  assert.equal(new Headers(requestHeaders()).get('x-stashbase-window-id'), 'web');
});

test('window identity prefers the Electron main-process assignment', () => {
  const originalWindow = globalThis.window;
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      electron: { windowId: 'native-window-7' },
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
      },
    },
  });
  try {
    assert.equal(getWindowId(), 'native-window-7');
    assert.equal(values.get('stashbase.windowId'), 'native-window-7');
    assert.equal(new Headers(requestHeaders()).get('x-stashbase-window-id'), 'native-window-7');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: Window }).window;
    } else {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    }
  }
});

test('2xx payloads that model failure as data resolve instead of throwing', async () => {
  const response = new Response(
    JSON.stringify({ status: 'failed', error: 'transcription failed' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

  const payload = await parseJsonOrThrow<{ status: string; error: string }>(response);
  assert.equal(payload.status, 'failed');
  assert.equal(payload.error, 'transcription failed');
});

test('JSON transport errors expose only server message, status, and code', async () => {
  const response = new Response(
    JSON.stringify({
      error: 'The file changed on disk.',
      code: 'STALE_VERSION',
      currentVersion: 'sha256:newer',
      unrelated: 'must not become an error property',
    }),
    { status: 409, headers: { 'content-type': 'application/json' } },
  );

  await assert.rejects(
    parseJsonOrThrow(response),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.message, 'The file changed on disk.');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'STALE_VERSION');
      assert.equal('currentVersion' in error, false);
      assert.equal('unrelated' in error, false);
      return true;
    },
  );
});

test('folder mutation transport retries an aborted request on a fresh connection', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new DOMException('request timed out', 'AbortError');
    return new Response(JSON.stringify({ current: { path: '/library', name: 'library' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await sendWithNetworkRetry<{ current: { path: string } }>(
      'POST',
      '/api/folder',
      { path: '/library' },
    );
    assert.equal(result.current.path, '/library');
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('folder mutation transport aborts a pending response instead of waiting forever', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  let aborts = 0;
  globalThis.fetch = async (_input, init) => {
    attempts += 1;
    if (attempts === 1) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborts += 1;
          reject(new DOMException('request timed out', 'AbortError'));
        }, { once: true });
      });
    }
    return new Response(JSON.stringify({ current: { path: '/library', name: 'library' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await sendWithNetworkRetry<{ current: { path: string } }>(
      'POST',
      '/api/folder',
      { path: '/library' },
      { attemptTimeoutMs: 1, retryDelaysMs: [0] },
    );
    assert.equal(result.current.path, '/library');
    assert.equal(attempts, 2);
    assert.equal(aborts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('search popup sends an explicit global scope independently of Chat defaults', async (t) => {
  const { api } = await import('@/common/api/api');
  const requests: Record<string, unknown>[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({ hits: [] }), { status: 200 });
  });
  await api.librarySearch('answer');
  await api.librarySearch('answer', 8, { folder: '/library/one' });
  assert.deepEqual(requests, [
    { query: 'answer', top_k: 8, scope: 'library' },
    { query: 'answer', top_k: 8, folder: '/library/one' },
  ]);
});
