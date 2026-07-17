import assert from 'node:assert/strict';
import test from 'node:test';
import { permanentlyDeleteCodexThread } from '../codex-agent.ts';

test('Codex Delete Chat uses the native irreversible thread/delete operation', async () => {
  const requests: Array<{ method: string; params: unknown }> = [];

  await permanentlyDeleteCodexThread(async (method, params) => {
    requests.push({ method, params });
  }, 'thread-123');

  assert.deepEqual(requests, [{ method: 'thread/delete', params: { threadId: 'thread-123' } }]);
});
