import assert from 'node:assert/strict';
import test from 'node:test';
import { localComponentStatusSchema, localComponentRetryRequestSchema } from './local-components.ts';

test('component state exposes bounded failure kinds, never native paths or remote authority', () => {
  assert.equal(localComponentStatusSchema.safeParse({ status: 'failed', error: '/private/internal/path' }).success, false);
  assert.equal(localComponentRetryRequestSchema.safeParse({ url: 'https://example.com/runtime' }).success, false);
  assert.equal(localComponentStatusSchema.safeParse({ status: 'downloading', error: null }).success, true);
});
