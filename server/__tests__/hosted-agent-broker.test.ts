import assert from 'node:assert/strict';
import test from 'node:test';
import { HostedAgentBroker } from '../hosted-agent-broker.ts';

test('hosted Agent broker keeps the account credential upstream and streams an OpenAI-compatible response', async (t) => {
  const accessCalls: boolean[] = [];
  const upstream: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; body: string }> = [];
  const broker = new HostedAgentBroker({
    accessToken: async ({ forceRefresh = false } = {}) => {
      accessCalls.push(forceRefresh);
      return forceRefresh ? 'fresh-account-token' : 'stale-account-token';
    },
    fetch: async (input, init) => {
      upstream.push({
        url: String(input),
        authorization: new Headers(init?.headers).get('authorization'),
        idempotencyKey: new Headers(init?.headers).get('idempotency-key'),
        body: String(init?.body),
      });
      if (upstream.length === 1) return new Response('{}', { status: 401 });
      return new Response('data: {"choices":[]}\n\ndata: [DONE]\n\n', {
        headers: { 'content-type': 'text/event-stream' },
      });
    },
    upstreamUrl: 'https://gateway.invalid/v1/agent/chat/completions',
    clientVersion: () => 'test-version',
  });
  await broker.start();
  t.after(() => broker.close());
  const runtime = broker.runtime()!;

  const response = await fetch(`${runtime.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${runtime.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: runtime.model, messages: [{ role: 'user', content: 'hello' }], stream: true }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  assert.match(await response.text(), /\[DONE\]/);
  assert.deepEqual(accessCalls, [false, true]);
  assert.equal(upstream.length, 2);
  assert.equal(upstream[0].authorization, 'Bearer stale-account-token');
  assert.equal(upstream[1].authorization, 'Bearer fresh-account-token');
  assert.ok(upstream[0].idempotencyKey);
  assert.equal(upstream[1].idempotencyKey, upstream[0].idempotencyKey);
  assert.equal(upstream[0].url, 'https://gateway.invalid/v1/agent/chat/completions');
  assert.doesNotMatch(upstream[0].body, /account-token/);
});

test('hosted Agent broker translates exhausted allowance into the stable local error', async (t) => {
  const broker = new HostedAgentBroker({
    accessToken: async () => 'account-token',
    fetch: async () => Response.json({ error: { code: 'quota_exhausted', message: 'Reset next month.' } }, { status: 402 }),
    upstreamUrl: 'https://gateway.invalid/v1/agent/chat/completions',
    clientVersion: () => 'test-version',
  });
  await broker.start();
  t.after(() => broker.close());
  const runtime = broker.runtime()!;
  const response = await fetch(`${runtime.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${runtime.apiKey}`, 'content-type': 'application/json' },
    body: '{}',
  });
  const payload = await response.json() as { error: { message: string; code: string } };
  assert.equal(response.status, 402);
  assert.match(payload.error.message, /^StashBase monthly Agent allowance exhausted\./);
  assert.equal(payload.error.code, 'quota_exhausted');
});

test('hosted Agent broker rejects non-broker credentials before contacting the gateway', async (t) => {
  let called = false;
  const broker = new HostedAgentBroker({
    accessToken: async () => 'account-token',
    fetch: async () => { called = true; return new Response('{}'); },
    upstreamUrl: 'https://gateway.invalid/v1/agent/chat/completions',
    clientVersion: () => 'test-version',
  });
  await broker.start();
  t.after(() => broker.close());
  const response = await fetch(`${broker.runtime()!.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: 'Bearer wrong', 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 401);
  assert.equal(called, false);
});
