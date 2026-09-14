import assert from 'node:assert/strict';
import test from 'node:test';
import { HostedAgentBroker } from '../hosted-agent-broker.ts';
import { OpenCodeEventTranslator } from '../opencode-agent.ts';

test('hosted Agent broker keeps the account credential upstream and streams an OpenAI-compatible response', async (t) => {
  const accessCalls: boolean[] = [];
  const upstream: Array<{ url: string; authorization: string | null; idempotencyKey: string | null; turnId: string | null; profile: string | null; body: string }> = [];
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
        turnId: new Headers(init?.headers).get('x-stashbase-agent-turn-id'),
        profile: new Headers(init?.headers).get('x-stashbase-agent-profile'),
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
  const runtime = broker.runtime('agent-session-1')!;
  broker.beginTurn('agent-session-1', '00000000-0000-4000-8000-000000000001');

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
  assert.equal(upstream[0].turnId, '00000000-0000-4000-8000-000000000001');
  assert.equal(upstream[1].turnId, upstream[0].turnId);
  assert.equal(upstream[0].profile, 'stashbase-agent-default');
  assert.equal(runtime.model, 'stashbase-agent-default');
  assert.equal(upstream[0].url, 'https://gateway.invalid/v1/agent/chat/completions');
  assert.doesNotMatch(upstream[0].body, /account-token/);
});

for (const scenario of [
  { code: 'agent_allowance_exhausted', message: 'OpenQuill free credits are exhausted.', kind: 'allowance-exhausted' },
  { code: 'agent_turn_budget_exhausted', message: 'This Agent turn reached its spending limit.', kind: 'quota' },
]) {
  test(`hosted Agent broker preserves ${scenario.code} through the OpenCode translator`, async (t) => {
    const broker = new HostedAgentBroker({
      accessToken: async () => 'account-token',
      fetch: async () => Response.json({ code: scenario.code, message: 'Limit reached.' }, { status: 402 }),
      upstreamUrl: 'https://gateway.invalid/v1/agent/chat/completions',
      clientVersion: () => 'test-version',
    });
    await broker.start();
    t.after(() => broker.close());
    const runtime = broker.runtime('agent-session-2')!;
    broker.beginTurn('agent-session-2', '00000000-0000-4000-8000-000000000002');
    const response = await fetch(`${runtime.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${runtime.apiKey}`, 'content-type': 'application/json' },
      body: '{}',
    });
    const payload = await response.json() as { error: { message: string; code: string } };
    assert.equal(response.status, 402);
    assert.equal(payload.error.message, `${scenario.message} Limit reached.`);
    assert.equal(payload.error.code, scenario.code);
    const translator = new OpenCodeEventTranslator();
    translator.bindSession('ours');
    translator.beginTurn();
    assert.deepEqual(translator.translate({
      type: 'session.error',
      properties: {
        sessionID: 'ours',
        error: { name: 'APIError', data: { message: payload.error.message, isRetryable: false } },
      },
    }), [
      { t: 'error', message: payload.error.message, failure: { kind: scenario.kind } },
      { t: 'turn-end', isError: true },
    ]);
  });
}

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

test('hosted Agent broker isolates session credentials and rejects calls outside an active turn', async (t) => {
  let called = false;
  const broker = new HostedAgentBroker({
    accessToken: async () => 'account-token',
    fetch: async () => { called = true; return new Response('{}'); },
    upstreamUrl: 'https://gateway.invalid/v1/agent/chat/completions',
    clientVersion: () => 'test-version',
  });
  await broker.start();
  t.after(() => broker.close());
  const first = broker.runtime('agent-session-a')!;
  const second = broker.runtime('agent-session-b')!;
  assert.notEqual(first.apiKey, second.apiKey);

  const response = await fetch(`${first.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${first.apiKey}`, 'content-type': 'application/json' },
    body: '{}',
  });
  const payload = await response.json() as { error: { code: string } };
  assert.equal(response.status, 409);
  assert.equal(payload.error.code, 'agent_turn_required');
  assert.equal(called, false);
  assert.throws(
    () => broker.beginTurn('agent-session-a', 'not-a-uuid'),
    /turn id must be a valid UUID/,
  );
});
