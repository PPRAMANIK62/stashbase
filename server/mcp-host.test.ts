import assert from 'node:assert/strict';
import test from 'node:test';
import {
  __bumpMcpGenerationForTest,
  __commitMcpServersForGenerationForTest,
  __setMcpServersForTest,
  callSpaceMcpTool,
  listSpaceMcpTools,
  stopSpaceMcpServers,
} from './mcp-host.ts';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

test('listSpaceMcpTools drops stale tools after a window MCP stop', async () => {
  const ready = deferred();
  __setMcpServersForTest('mcp-list-stale', [{
    name: 'slow',
    ready: ready.promise,
    tools: [{
      server: 'slow',
      name: 'lookup',
      fqName: 'slow/lookup',
      inputSchema: {},
    }],
  }]);

  const pending = listSpaceMcpTools('mcp-list-stale');
  await stopSpaceMcpServers('mcp-list-stale');
  ready.resolve();

  assert.deepEqual(await pending, []);
});

test('callSpaceMcpTool rejects a stale call after a window MCP stop', async () => {
  const ready = deferred();
  let called = false;
  __setMcpServersForTest('mcp-call-stale', [{
    name: 'slow',
    ready: ready.promise,
    tools: [{
      server: 'slow',
      name: 'write_file',
      fqName: 'slow/write_file',
      inputSchema: {},
    }],
    callTool: async () => {
      called = true;
      return { ok: true };
    },
  }]);

  const pending = callSpaceMcpTool('mcp-call-stale', 'slow/write_file', {});
  await stopSpaceMcpServers('mcp-call-stale');
  ready.resolve();

  await assert.rejects(pending, /MCP server changed/);
  assert.equal(called, false);
});

test('stale MCP switch completion cannot overwrite newer window servers', async () => {
  const windowId = 'mcp-switch-race';
  const staleGeneration = __bumpMcpGenerationForTest(windowId);
  const currentGeneration = __bumpMcpGenerationForTest(windowId);
  let staleClosed = false;

  const currentCommitted = await __commitMcpServersForGenerationForTest(windowId, currentGeneration, [{
    name: 'current',
    tools: [{
      server: 'current',
      name: 'lookup',
      fqName: 'current/lookup',
      inputSchema: {},
    }],
  }]);
  const staleCommitted = await __commitMcpServersForGenerationForTest(windowId, staleGeneration, [{
    name: 'stale',
    tools: [{
      server: 'stale',
      name: 'old_lookup',
      fqName: 'stale/old_lookup',
      inputSchema: {},
    }],
    close: async () => { staleClosed = true; },
  }]);

  assert.equal(currentCommitted, true);
  assert.equal(staleCommitted, false);
  assert.equal(staleClosed, true);
  assert.deepEqual((await listSpaceMcpTools(windowId)).map((t) => t.fqName), ['current/lookup']);

  await stopSpaceMcpServers(windowId);
});
