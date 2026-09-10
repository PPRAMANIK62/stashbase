import assert from 'node:assert/strict';
import test from 'node:test';

import {
  externalNavigationRequestSchema,
  externalNavigationResponseSchema,
} from './external-navigation.ts';

test('external navigation accepts only credential-free HTTP(S) URLs', () => {
  assert.deepEqual(externalNavigationRequestSchema.parse({ url: 'https://example.com/docs' }), {
    url: 'https://example.com/docs',
  });
  for (const url of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'mailto:person@example.com',
    'https://person:secret@example.com/',
    '//example.com/path',
  ]) {
    assert.equal(externalNavigationRequestSchema.safeParse({ url }).success, false);
  }
});

test('external navigation responses reject unowned fields', () => {
  assert.deepEqual(externalNavigationResponseSchema.parse({ ok: true }), { ok: true });
  assert.equal(
    externalNavigationResponseSchema.safeParse({ ok: true, openedUrl: 'https://example.com' })
      .success,
    false,
  );
});
