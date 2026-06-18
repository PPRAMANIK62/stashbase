import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  __activeAgentSessionCountForTest,
  __setAgentSessionForTest,
  attachAgentWebSocket,
  killActiveAgent,
  sessionInfoMatchesCwd,
} from './agent.ts';
import {
  __activeCodexSessionCountForTest,
  __codexAppServerMappingForTest,
  __setCodexSessionForTest,
  attachCodexWebSocket,
  killActiveCodex,
} from './codex-agent.ts';

test('sessionInfoMatchesCwd only allows sessions from the active space cwd', () => {
  const cwd = path.resolve('/tmp/stashbase-space');

  assert.equal(sessionInfoMatchesCwd({ cwd }, cwd), true);
  assert.equal(sessionInfoMatchesCwd({ cwd: path.join(cwd, '..', path.basename(cwd)) }, cwd), true);
  assert.equal(sessionInfoMatchesCwd({ cwd: '/tmp/other-space' }, cwd), false);
  assert.equal(sessionInfoMatchesCwd({ cwd: undefined }, cwd), false);
  assert.equal(sessionInfoMatchesCwd(null, cwd), false);
});

test('killActiveAgent disposes and unregisters only the requested window sessions', () => {
  const disposed: string[] = [];
  const cleanupA = __setAgentSessionForTest({ windowId: 'agent-a', dispose: () => disposed.push('a') });
  const cleanupB = __setAgentSessionForTest({ windowId: 'agent-b', dispose: () => disposed.push('b') });
  try {
    const before = __activeAgentSessionCountForTest();
    killActiveAgent('agent-a');

    assert.deepEqual(disposed, ['a']);
    assert.equal(__activeAgentSessionCountForTest(), before - 1);

    killActiveAgent('agent-a');
    assert.deepEqual(disposed, ['a']);

    killActiveAgent('agent-b');
    assert.deepEqual(disposed, ['a', 'b']);
    assert.equal(__activeAgentSessionCountForTest(), before - 2);
  } finally {
    cleanupA();
    cleanupB();
  }
});

test('killActiveAgent without a window disposes every registered session', () => {
  const disposed: string[] = [];
  const cleanupA = __setAgentSessionForTest({ windowId: 'agent-all-a', dispose: () => disposed.push('a') });
  const cleanupB = __setAgentSessionForTest({ windowId: 'agent-all-b', dispose: () => disposed.push('b') });
  try {
    const before = __activeAgentSessionCountForTest();
    killActiveAgent();

    assert.deepEqual(disposed.sort(), ['a', 'b']);
    assert.equal(__activeAgentSessionCountForTest(), before - 2);
  } finally {
    cleanupA();
    cleanupB();
  }
});

test('killActiveCodex disposes only the requested window sessions', () => {
  const disposed: string[] = [];
  const cleanupA = __setCodexSessionForTest({ windowId: 'codex-a', dispose: () => disposed.push('a') });
  const cleanupB = __setCodexSessionForTest({ windowId: 'codex-b', dispose: () => disposed.push('b') });
  try {
    const before = __activeCodexSessionCountForTest();
    killActiveCodex('codex-a');

    assert.deepEqual(disposed, ['a']);
    assert.equal(__activeCodexSessionCountForTest(), before - 1);

    killActiveCodex();
    assert.deepEqual(disposed.sort(), ['a', 'b']);
    assert.equal(__activeCodexSessionCountForTest(), before - 2);
  } finally {
    cleanupA();
    cleanupB();
  }
});

test('agent websocket startup failure unregisters the session it just created', () => {
  class FakeWs {
    readyState = 1;
    sent: unknown[] = [];
    on(): void { /* event hooks are not needed for this no-space startup path */ }
    send(data: string): void { this.sent.push(JSON.parse(data)); }
    close(): void { this.readyState = 3; }
  }

  const before = __activeAgentSessionCountForTest();
  const ws = new FakeWs();

  attachAgentWebSocket(ws as never, '  no-space-window  ');

  assert.equal(__activeAgentSessionCountForTest(), before);
  assert.deepEqual(ws.sent, [
    { t: 'error', message: 'No space open.' },
    { t: 'exit' },
  ]);
});

test('codex websocket startup failure unregisters the session it just created', () => {
  class FakeWs {
    readyState = 1;
    sent: unknown[] = [];
    on(): void { /* event hooks are not needed for this no-space startup path */ }
    send(data: string): void { this.sent.push(JSON.parse(data)); }
    close(): void { this.readyState = 3; }
  }

  const before = __activeCodexSessionCountForTest();
  const ws = new FakeWs();

  attachCodexWebSocket(ws as never, '  no-space-codex-window  ');

  assert.equal(__activeCodexSessionCountForTest(), before);
  assert.deepEqual(ws.sent, [
    { t: 'error', message: 'No space open.' },
    { t: 'exit' },
  ]);
});

test('codex app-server item mapping surfaces command tool cards', () => {
  const started = __codexAppServerMappingForTest.toolStartFromItem({
    type: 'commandExecution',
    id: 'cmd-1',
    command: 'pnpm test',
    cwd: '/tmp/space',
  });
  assert.deepEqual(started, {
    id: 'cmd-1',
    name: 'Bash',
    input: { command: 'pnpm test', cwd: '/tmp/space' },
  });

  const completed = __codexAppServerMappingForTest.toolResultFromItem({
    type: 'commandExecution',
    id: 'cmd-1',
    aggregatedOutput: 'ok',
    exitCode: 0,
  });
  assert.deepEqual(completed, {
    id: 'cmd-1',
    content: 'ok',
    isError: false,
  });
});

test('codex app-server item mapping surfaces mcp and file-change results', () => {
  const mcpStarted = __codexAppServerMappingForTest.toolStartFromItem({
    type: 'mcpToolCall',
    id: 'mcp-1',
    server: 'stashbase',
    tool: 'search_kb',
    arguments: { query: 'demo' },
  });
  assert.deepEqual(mcpStarted, {
    id: 'mcp-1',
    name: 'stashbase:search_kb',
    input: { query: 'demo' },
  });

  const mcpFailed = __codexAppServerMappingForTest.toolResultFromItem({
    type: 'mcpToolCall',
    id: 'mcp-1',
    status: 'failed',
    error: { message: 'boom' },
  });
  assert.equal(mcpFailed?.id, 'mcp-1');
  assert.equal(mcpFailed?.isError, true);
  assert.match(mcpFailed?.content ?? '', /boom/);

  const fileStarted = __codexAppServerMappingForTest.toolStartFromItem({
    type: 'fileChange',
    id: 'file-1',
    changes: [{ path: 'note.md' }],
  });
  assert.deepEqual(fileStarted, {
    id: 'file-1',
    name: 'File change',
    input: { changes: [{ path: 'note.md' }] },
  });
});

test('codex app-server mapping parses nested errors and effort options', () => {
  assert.equal(__codexAppServerMappingForTest.notificationMessage({
    error: { message: 'stream disconnected' },
    willRetry: false,
  }), 'stream disconnected');
  assert.deepEqual(__codexAppServerMappingForTest.codexEffortOption('max'), { effort: 'xhigh' });
  assert.deepEqual(__codexAppServerMappingForTest.codexEffortOption('medium'), { effort: 'medium' });
  assert.deepEqual(__codexAppServerMappingForTest.codexEffortOption('nope'), {});
});

test('codex app-server mapping extracts tool output deltas', () => {
  assert.deepEqual(__codexAppServerMappingForTest.toolOutputDeltaFromParams({
    itemId: 'cmd-1',
    delta: 'hello\n',
    stream: 'stdout',
  }), { id: 'cmd-1', delta: 'hello\n' });

  assert.deepEqual(__codexAppServerMappingForTest.toolOutputDeltaFromParams({
    tool_use_id: 'cmd-2',
    output: { text: 'permission denied\n' },
    stream: 'stderr',
  }), { id: 'cmd-2', delta: '[stderr] permission denied\n' });

  assert.equal(__codexAppServerMappingForTest.toolOutputDeltaFromParams({ delta: 'orphan' }), null);
});

test('codex app-server thread history maps to chat blocks', () => {
  const blocks = __codexAppServerMappingForTest.codexThreadToBlocks({
    turns: [{
      items: [
        { type: 'userMessage', id: 'u1', content: [{ type: 'text', text: 'hello', text_elements: [] }] },
        { type: 'agentMessage', id: 'a1', text: 'hi', phase: 'final_answer', memoryCitation: null },
        { type: 'reasoning', id: 'r1', summary: ['thinking'], content: [] },
        {
          type: 'commandExecution',
          id: 'cmd-1',
          command: 'pwd',
          cwd: '/tmp',
          aggregatedOutput: '/tmp\n',
          exitCode: 0,
        },
      ],
    }],
  });

  assert.deepEqual(blocks, [
    { kind: 'user', id: 'c0', text: 'hello' },
    { kind: 'assistant', id: 'c1', text: 'hi' },
    { kind: 'thinking', id: 'c2', text: 'thinking' },
    {
      kind: 'tool',
      id: 'c3',
      name: 'Bash',
      input: { command: 'pwd', cwd: '/tmp' },
      status: 'done',
      result: '/tmp\n',
    },
  ]);
});
