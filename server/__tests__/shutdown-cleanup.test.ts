import assert from 'node:assert/strict';
import test from 'node:test';
import { runShutdownCleanup } from '../shutdown-cleanup.ts';

test('MCP listener close failure cannot skip conversion and indexer cleanup', async () => {
  const events: string[] = [];
  await runShutdownCleanup({
    closeMcp: async () => { events.push('mcp'); throw new Error('close failed'); },
    cancelAgentInstalls: async () => { events.push('agent-installs'); return []; },
    closeBundledAgent: async () => { events.push('bundled-agent'); },
    closeHostedBroker: async () => { events.push('hosted'); },
    cancelGitHubImports: async () => { events.push('github-imports'); return 0; },
    cancelModelDownloads: async () => { events.push('model-downloads'); return []; },
    cancelConversions: async () => { events.push('conversions'); return []; },
    closeStateDb: () => { events.push('state-db'); },
    closeIndexer: async () => { events.push('indexer'); },
    onError: (step) => { events.push(`error:${step}`); },
  });
  assert.deepEqual(events, ['mcp', 'error:mcp-http', 'agent-installs', 'bundled-agent', 'hosted', 'github-imports', 'model-downloads', 'conversions', 'state-db', 'indexer']);
});
