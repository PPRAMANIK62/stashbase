import assert from 'node:assert/strict';
import test from 'node:test';

import {
  embedderKeyRequestSchema,
  embedderStateSchema,
  hostedOAuthStartResponseSchema,
} from './embedder.ts';

test('embedder state accepts a signed-in hosted account with a quota', () => {
  const parsed = embedderStateSchema.parse({
    account: {
      active: true,
      displayName: 'Ada',
      email: 'ada@example.com',
      quota: {
        grantedTokens: 1000,
        periodEndsAt: '2026-10-01T00:00:00.000Z',
        periodStartedAt: '2026-09-01T00:00:00.000Z',
        plan: 'free',
        remainingTokens: 250,
        reservedTokens: 0,
        usedTokens: 750,
      },
      signedIn: true,
    },
    authorized: true,
    hasKey: false,
    model: 'hosted',
    provider: 'openai',
    source: 'stashbase-account',
  });
  assert.equal(parsed.account.quota?.remainingTokens, 250);
});

test('embedder requests reject an unknown provider and a missing key', () => {
  assert.equal(embedderKeyRequestSchema.safeParse({ key: 'sk', provider: 'openai' }).success, true);
  assert.equal(embedderKeyRequestSchema.safeParse({ key: '', provider: 'openai' }).success, false);
  assert.equal(embedderKeyRequestSchema.safeParse({ key: 'sk', provider: 'gemini' }).success, false);
  assert.equal(
    hostedOAuthStartResponseSchema.safeParse({ flowId: 'f', provider: 'google', purpose: 'embedding', url: 'nope' }).success,
    false,
  );
});
