import assert from 'node:assert/strict';
import test from 'node:test';
import { runShutdownCleanup } from '../shutdown-cleanup.ts';

test('MCP listener close failure cannot skip conversion and indexer cleanup', async () => {
  const events: string[] = [];
  await runShutdownCleanup({
    closeMcp: async () => { events.push('mcp'); throw new Error('close failed'); },
    cancelConversions: async () => { events.push('conversions'); return []; },
    closeStateDb: () => { events.push('state-db'); },
    closeIndexer: async () => { events.push('indexer'); },
    onError: (step) => { events.push(`error:${step}`); },
  });
  assert.deepEqual(events, ['mcp', 'error:mcp-http', 'conversions', 'state-db', 'indexer']);
});
