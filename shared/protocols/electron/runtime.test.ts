import assert from 'node:assert/strict';
import test from 'node:test';

import { rendererRuntimeConfigSchema } from './runtime.ts';

test('renderer runtime config accepts only the local server origin', () => {
  assert.deepEqual(
    rendererRuntimeConfigSchema.parse({ serverOrigin: 'http://127.0.0.1:8090' }),
    { serverOrigin: 'http://127.0.0.1:8090' },
  );
  for (const serverOrigin of [
    'https://127.0.0.1:8090',
    'http://localhost:8090',
    'http://127.0.0.1:8090/api',
    'http://person@127.0.0.1:8090',
    'https://example.com',
  ]) {
    assert.equal(rendererRuntimeConfigSchema.safeParse({ serverOrigin }).success, false);
  }
});

test('renderer runtime config rejects unowned fields', () => {
  assert.equal(
    rendererRuntimeConfigSchema.safeParse({
      serverOrigin: 'http://127.0.0.1:8090',
      windowId: 'must-remain-main-owned',
    }).success,
    false,
  );
});
