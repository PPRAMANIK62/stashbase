import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runIsolated(source: string) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-hosted-account-test-'));
  try {
    return spawnSync(process.execPath, [
      '--no-warnings',
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      source,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, HOME: home },
      timeout: 15_000,
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('email OTP session persists locally and authenticates quota requests', () => {
  const result = runIsolated(`
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null, authorization: new Headers(init.headers).get('authorization') });
      if (String(url).endsWith('/auth/v1/otp')) return new Response('{}', { status: 200 });
      if (String(url).endsWith('/auth/v1/verify')) return Response.json({
        access_token: 'access-1', refresh_token: 'refresh-1', expires_at: 4102444800,
        user: { id: 'user-1', email: 'person@example.com' },
      });
      if (String(url).endsWith('/v1/account/usage')) return Response.json({
        plan: 'free', grantedTokens: 1000000, usedTokens: 12, reservedTokens: 0,
        remainingTokens: 999988, periodStartedAt: '2026-08-01T00:00:00.000Z', periodEndsAt: '2026-09-01T00:00:00.000Z',
      });
      throw new Error('unexpected URL ' + url);
    };
    const account = await import('./server/hosted-account.ts');
    const config = await import('./server/app-config.ts');
    await account.requestEmailOtp('Person@Example.com');
    await account.verifyEmailOtp('Person@Example.com', '123456');
    config.setEmbeddingSource('stashbase-account');
    const quota = await account.fetchHostedQuota();
    process.stdout.write(JSON.stringify({ calls, quota, session: config.getHostedAccountSession(), source: config.getEmbeddingSource() }));
  `);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.calls[0].body.email, 'person@example.com');
  assert.equal(output.calls[1].body.type, 'email');
  assert.equal(output.calls[2].authorization, 'Bearer access-1');
  assert.equal(output.quota.remainingTokens, 999_988);
  assert.equal(output.session.refreshToken, 'refresh-1');
  assert.equal(output.source, 'stashbase-account');
});

test('loopback broker translates OpenAI requests and preserves query purpose', () => {
  const result = runIsolated(`
    const originalFetch = globalThis.fetch;
    const upstream = [];
    globalThis.fetch = async (url, init = {}) => {
      if (String(url).startsWith('http://127.0.0.1:')) return originalFetch(url, init);
      upstream.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null, headers: Object.fromEntries(new Headers(init.headers)) });
      return Response.json({
        profile: 'stashbase-embedding-v1',
        data: [{ index: 0, embedding: [0.25, 0.75] }],
        usage: { inputTokens: 3 },
        quota: { plan: 'free', grantedTokens: 1000000, usedTokens: 3, reservedTokens: 0, remainingTokens: 999997, periodStartedAt: null, periodEndsAt: null },
      });
    };
    const config = await import('./server/app-config.ts');
    config.setHostedAccountSession({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresAt: 4102444800, userId: 'user-2', email: 'person@example.com' });
    config.setEmbeddingSource('stashbase-account');
    const broker = await import('./server/hosted-embedding-broker.ts');
    await broker.startHostedEmbeddingBroker();
    const runtime = broker.hostedEmbeddingRuntime();
    const response = await originalFetch(runtime.baseUrl + '/embeddings', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + runtime.apiKey, 'content-type': 'application/json', 'x-stashbase-purpose': 'query' },
      body: JSON.stringify({ model: runtime.model, input: ['hello'] }),
    });
    const body = await response.json();
    await broker.stopHostedEmbeddingBroker();
    process.stdout.write(JSON.stringify({ status: response.status, body, upstream }));
  `);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, 200);
  assert.deepEqual(output.body.data[0].embedding, [0.25, 0.75]);
  assert.equal(output.body.usage.prompt_tokens, 3);
  assert.equal(output.upstream[0].body.purpose, 'query');
  assert.deepEqual(output.upstream[0].body.inputs, ['hello']);
  assert.match(output.upstream[0].headers['idempotency-key'], /^[0-9a-f-]{36}$/);
});
