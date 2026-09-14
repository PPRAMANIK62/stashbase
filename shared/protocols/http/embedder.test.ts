import assert from 'node:assert/strict';
import test from 'node:test';

import {
  embedderKeyRequestSchema,
  embedderStateSchema,
  hostedOAuthStartResponseSchema,
} from './embedder.ts';

test('embedder state contains only BYOK source state', () => {
  const parsed = embedderStateSchema.parse({
    authorized: true,
    hasKey: true,
    model: 'text-embedding-3-small',
    provider: 'openai',
    source: 'openai',
  });
  assert.equal(parsed.source, 'openai');
});

test('embedder requests reject an unknown provider and a missing key', () => {
  assert.equal(embedderKeyRequestSchema.safeParse({ key: 'sk', provider: 'openai' }).success, true);
  assert.equal(embedderKeyRequestSchema.safeParse({ key: '', provider: 'openai' }).success, false);
  assert.equal(embedderKeyRequestSchema.safeParse({ key: 'sk', provider: 'gemini' }).success, false);
  assert.equal(
    hostedOAuthStartResponseSchema.safeParse({ flowId: 'f', provider: 'google', purpose: 'embedding', url: 'https://example.com' }).success,
    false,
  );
});
