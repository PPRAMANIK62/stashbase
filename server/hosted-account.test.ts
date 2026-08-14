import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { oauthResultPage } from './oauth-result-page.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('OAuth callback renders a safe centered card with delayed app return and fallback button', () => {
  const html = oauthResultPage({
    title: 'Signed in <now>',
    message: 'Ready & returning',
    autoReturn: true,
    returnStatusUrl: '/api/account/oauth/status?flow=safe-flow',
    returnIntentUrl: '/api/account/oauth/return-intent?flow=safe-flow',
  });

  assert.match(html, /class="shell"/);
  assert.match(html, /class="card" data-auto-return="true"/);
  assert.match(html, /href="stashbase:\/\/oauth-complete" hidden/);
  assert.match(html, /window\.location\.href = 'stashbase:\/\/oauth-complete'/);
  assert.match(html, /window\.close\(\)/);
  assert.match(html, /fetch\(returnStatusUrl/);
  assert.match(html, /fetch\(returnIntentUrl, \{ method: 'POST'/);
  assert.match(html, /result\.appReturned === true/);
  assert.doesNotMatch(html, /addEventListener\('blur'/);
  assert.match(html, /Didn’t return automatically\?/);
  assert.match(html, /Signed in &lt;now&gt;/);
  assert.match(html, /Ready &amp; returning/);
  assert.doesNotMatch(html, /Signed in <now>/);
});

test('failed OAuth callback keeps the return button visible without automatic launch', () => {
  const html = oauthResultPage({
    title: 'Sign-in failed',
    message: 'Try again.',
    kind: 'error',
  });

  assert.match(html, /data-auto-return="false"/);
  assert.match(html, /href="stashbase:\/\/oauth-complete">/);
  assert.doesNotMatch(html, /href="stashbase:\/\/oauth-complete" hidden/);
});

test('a failed callback can receive app-return proof through an opaque local status ticket', () => {
  const result = runIsolated(`
    const account = await import('./server/hosted-account.ts');
    const flowId = account.createFailedHostedOAuthFlow('Missing sign-in flow.');
    const before = account.hostedOAuthStatus(flowId);
    account.noteHostedOAuthReturnIntent(flowId);
    const acknowledged = account.noteHostedOAuthAppReturn();
    const after = account.hostedOAuthStatus(flowId);
    process.stdout.write(JSON.stringify({ flowId, before, acknowledged, after }));
  `);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.match(output.flowId, /^[A-Za-z0-9_-]+$/);
  assert.equal(output.before.state, 'error');
  assert.equal(output.before.appReturned, undefined);
  assert.deepEqual(output.acknowledged, { acknowledged: true });
  assert.equal(output.after.appReturned, true);
});

test('a data-free native return focuses the window attached to the browser return intent', () => {
  const result = runIsolated(`
    const account = await import('./server/hosted-account.ts');
    const first = account.beginHostedOAuth('google', 'http://127.0.0.1:8090', 'window-one');
    const second = account.beginHostedOAuth('google', 'http://127.0.0.1:8090', 'window-two');
    account.failHostedOAuth(first.flowId, 'first stopped');
    account.failHostedOAuth(second.flowId, 'second stopped');
    account.noteHostedOAuthReturnIntent(first.flowId);
    const acknowledged = account.noteHostedOAuthAppReturn();
    process.stdout.write(JSON.stringify({ acknowledged, first: account.hostedOAuthStatus(first.flowId), second: account.hostedOAuthStatus(second.flowId) }));
  `);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.acknowledged, { acknowledged: true, windowId: 'window-one' });
  assert.equal(output.first.appReturned, true);
  assert.equal(output.second.appReturned, undefined);
});

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

test('OAuth PKCE session persists locally and authenticates quota requests', () => {
  const result = runIsolated(`
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null, authorization: new Headers(init.headers).get('authorization') });
      if (String(url).endsWith('/auth/v1/token?grant_type=pkce')) return Response.json({
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
    const started = account.beginHostedOAuth('google', 'http://127.0.0.1:8090');
    await account.exchangeHostedOAuthCode(started.flowId, 'auth-code-1');
    account.finishHostedOAuth(started.flowId);
    account.noteHostedOAuthAppReturn();
    config.setEmbeddingSource('stashbase-account');
    const quota = await account.fetchHostedQuota();
    const state = await account.hostedAccountState();
    process.stdout.write(JSON.stringify({ started, status: account.hostedOAuthStatus(started.flowId), calls, quota, state, session: config.getHostedAccountSession(), source: config.getEmbeddingSource() }));
  `);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const authorize = new URL(output.started.url);
  assert.equal(authorize.pathname, '/auth/v1/authorize');
  assert.equal(authorize.searchParams.get('provider'), 'google');
  const redirectTo = authorize.searchParams.get('redirect_to');
  assert.ok(redirectTo);
  assert.equal(new URL(redirectTo).searchParams.get('flow'), output.started.flowId);
  assert.equal(output.calls[0].body.auth_code, 'auth-code-1');
  const expectedChallenge = crypto.createHash('sha256').update(output.calls[0].body.code_verifier).digest('base64url');
  assert.equal(authorize.searchParams.get('code_challenge'), expectedChallenge);
  assert.equal(output.status.state, 'complete');
  assert.equal(output.status.appReturned, true);
  assert.equal(output.calls[1].authorization, 'Bearer access-1');
  assert.equal(output.quota.remainingTokens, 999_988);
  assert.equal(output.session.refreshToken, 'refresh-1');
  assert.equal(output.source, 'stashbase-account');
  assert.equal(output.state.email, 'person@example.com');
  assert.equal('userId' in output.state, false);
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

test('cached hosted exhaustion blocks semantic work and availability recovery notifies its owner', () => {
  const result = runIsolated(`
    const config = await import('./server/app-config.ts');
    const account = await import('./server/hosted-account.ts');
    const availability = await import('./server/embedding-availability.ts');
    config.setHostedAccountSession({ accessToken: 'access', refreshToken: 'refresh', expiresAt: 4102444800, userId: 'user', email: 'person@example.com' });
    config.setEmbeddingSource('stashbase-account');
    let recovered = 0;
    account.setHostedQuotaAvailableHandler(() => { recovered += 1; });
    account.rememberHostedQuota({ plan: 'free', grantedTokens: 1000000, usedTokens: 1000000, reservedTokens: 0, remainingTokens: 0, periodStartedAt: null, periodEndsAt: null });
    const exhausted = availability.embeddingAvailability();
    account.rememberHostedQuota({ plan: 'free', grantedTokens: 1000000, usedTokens: 0, reservedTokens: 0, remainingTokens: 1000000, periodStartedAt: null, periodEndsAt: null });
    await new Promise((resolve) => setImmediate(resolve));
    process.stdout.write(JSON.stringify({ exhausted, recovered }));
  `);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.exhausted, {
    configured: true,
    available: false,
    reason: 'hosted-quota-exhausted',
  });
  assert.equal(output.recovered, 1);
});

test('broker caches a quota response and does not retry later hosted requests', () => {
  const result = runIsolated(`
    const originalFetch = globalThis.fetch;
    let upstreamCalls = 0;
    globalThis.fetch = async (url, init = {}) => {
      if (String(url).startsWith('http://127.0.0.1:')) return originalFetch(url, init);
      upstreamCalls += 1;
      return Response.json({ code: 'quota_exhausted', message: 'quota exhausted' }, { status: 402 });
    };
    const config = await import('./server/app-config.ts');
    const account = await import('./server/hosted-account.ts');
    const broker = await import('./server/hosted-embedding-broker.ts');
    config.setHostedAccountSession({ accessToken: 'access', refreshToken: 'refresh', expiresAt: 4102444800, userId: 'user', email: 'person@example.com' });
    config.setEmbeddingSource('stashbase-account');
    await broker.startHostedEmbeddingBroker();
    const runtime = broker.hostedEmbeddingRuntime();
    const request = () => originalFetch(runtime.baseUrl + '/embeddings', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + runtime.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ model: runtime.model, input: ['hello'] }),
    });
    const first = await request();
    const second = await request();
    await broker.stopHostedEmbeddingBroker();
    process.stdout.write(JSON.stringify({ first: first.status, second: second.status, upstreamCalls, exhausted: account.isHostedQuotaExhausted() }));
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    first: 402,
    second: 402,
    upstreamCalls: 1,
    exhausted: true,
  });
});
