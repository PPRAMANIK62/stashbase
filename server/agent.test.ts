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
