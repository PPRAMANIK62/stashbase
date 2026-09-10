import assert from 'node:assert/strict';
import test from 'node:test';

import {
  windowContextReleaseReadySchema,
  windowContextReleaseRequestSchema,
} from './window-lifecycle.ts';

test('window lifecycle protocol accepts only correlated save-barrier messages', () => {
  assert.deepEqual(
    windowContextReleaseReadySchema.parse({
      ready: true,
      reason: 'window-close',
      requestId: 'request-1',
    }),
    { ready: true, reason: 'window-close', requestId: 'request-1' },
  );
  assert.equal(
    windowContextReleaseRequestSchema.safeParse({
      reason: 'navigation',
      requestId: 'request-1',
    }).success,
    false,
  );
  assert.equal(
    windowContextReleaseReadySchema.safeParse({
      future: true,
      ready: true,
      reason: 'window-reload',
      requestId: 'request-1',
    }).success,
    false,
  );
  assert.equal(
    windowContextReleaseRequestSchema.safeParse({
      reason: 'update-install',
      requestId: 'request-2',
    }).success,
    true,
  );
  assert.deepEqual(
    windowContextReleaseReadySchema.parse({
      ready: false,
      reason: 'update-install',
      requestId: 'request-2',
    }),
    { ready: false, reason: 'update-install', requestId: 'request-2' },
  );
});
