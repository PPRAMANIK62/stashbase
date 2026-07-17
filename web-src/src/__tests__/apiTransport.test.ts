import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiError,
  encodePath,
  getWindowId,
  parseJsonOrThrow,
  requestHeaders,
} from '../apiTransport';

test('encodePath preserves separators while encoding individual segments', () => {
  assert.equal(encodePath('notes/a b#c.md'), 'notes/a%20b%23c.md');
  assert.equal(
    encodePath('\u4e2d\u6587/\u8ba1\u5212.md'),
    '%E4%B8%AD%E6%96%87/%E8%AE%A1%E5%88%92.md',
  );
});

test('window identity falls back to web outside a browser session', () => {
  assert.equal(getWindowId(), 'web');
  assert.equal(new Headers(requestHeaders()).get('x-stashbase-window-id'), 'web');
});

test('JSON transport errors preserve server message, status, and code', async () => {
  const response = new Response(
    JSON.stringify({ error: 'The file changed on disk.', code: 'STALE_VERSION' }),
    { status: 409, headers: { 'content-type': 'application/json' } },
  );

  await assert.rejects(
    parseJsonOrThrow(response),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.message, 'The file changed on disk.');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'STALE_VERSION');
      return true;
    },
  );
});
