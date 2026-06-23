import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOpenAIKey } from './http.ts';

test('validateOpenAIKey accepts an ok OpenAI response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer sk-ok');
    assert.equal(init?.signal instanceof AbortSignal, true);
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  try {
    assert.deepEqual(await validateOpenAIKey('sk-ok'), { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('validateOpenAIKey maps OpenAI rejection to a user-facing 400', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('bad key', { status: 401 })) as typeof fetch;
  try {
    const result = await validateOpenAIKey('sk-bad');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.match(result.error, /OpenAI rejected the key \(HTTP 401\): bad key/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('validateOpenAIKey maps transient OpenAI failures to a retryable 502', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('try later', { status: 500 })) as typeof fetch;
  try {
    const result = await validateOpenAIKey('sk-transient');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 502);
      assert.match(result.error, /could not complete \(HTTP 500\): try later/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('validateOpenAIKey times out stalled network checks', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const signal = init?.signal;
    assert.equal(signal instanceof AbortSignal, true);
    await new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'AbortError')), { once: true });
    });
    throw new Error('unreachable');
  }) as typeof fetch;
  try {
    const result = await validateOpenAIKey('sk-timeout', { timeoutMs: 1 });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 502);
      assert.match(result.error, /network:/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
