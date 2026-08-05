import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { WebSocket } from 'ws';
import { clearAgentRuntimeFailure } from '../agent-contract.ts';
import { codexAccessOptions, isStashbaseWorkspaceEdit, isWorkspaceFileChange, permanentlyDeleteCodexThread } from '../codex-agent.ts';
import { CodexRpcPeer } from '../codex-rpc-transport.ts';
import { CodexSession } from '../codex-session-runtime.ts';
import { clearCurrentFolder, runWithWindowId, setCurrentFolder } from '../folder.ts';

class FakeCodexProcess extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  killed = false;

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

class FakeWebSocket extends EventEmitter {
  readyState = 1;
  sent: string[] = [];

  send(value: string): void {
    this.sent.push(value);
  }

  close(): void {
    this.readyState = 3;
    this.emit('close');
  }
}

function catalogProcess(models = [{ id: 'native-model', displayName: 'Native model' }]): { proc: FakeCodexProcess; requests: Array<{ method: string; params: Record<string, unknown> }> } {
  const proc = new FakeCodexProcess();
  const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
  proc.stdin.on('data', (chunk: Buffer) => {
    const request = JSON.parse(String(chunk)) as { id: number; method: string; params: Record<string, unknown> };
    requests.push({ method: request.method, params: request.params });
    const result = request.method === 'model/list' ? { data: models }
      : request.method === 'thread/start' ? { thread: { id: 'thread-1' } }
        : request.method === 'thread/resume' ? { thread: { id: 'thread-1' }, model: 'resumed-model' }
        : request.method === 'turn/start' ? { turn: { id: 'turn-1' } } : {};
    proc.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
  });
  return { proc, requests };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

test('Codex publishes its native model catalog before ready and forwards a selected model on the first turn', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-codex-model-'));
  runWithWindowId('model-window', () => setCurrentFolder(folder));
  t.after(() => { runWithWindowId('model-window', () => clearCurrentFolder()); fs.rmSync(folder, { recursive: true, force: true }); });
  const ws = new FakeWebSocket();
  const native = catalogProcess();
  const session = new CodexSession(ws as unknown as WebSocket, 'model-window', undefined, undefined, undefined, 'native-model', undefined, () => native.proc as unknown as ChildProcessWithoutNullStreams);
  session.begin();
  await settle();

  const events = ws.sent.map((item) => JSON.parse(item) as { t: string; models?: Array<{ id: string }>; activeModel?: string });
  assert.equal(events[0]?.t, 'models', JSON.stringify(events));
  assert.equal(events[0]?.models?.[0]?.id, 'native-model');
  assert.equal(events[0]?.activeModel, 'native-model');
  assert.equal(events[1]?.t, 'ready');

  ws.emit('message', JSON.stringify({ t: 'prompt', text: 'hello' }));
  await settle();
  assert.equal(native.requests.find((request) => request.method === 'turn/start')?.params.model, 'native-model');
  session.dispose();
});

test('Codex recovers unavailable selections to Default and never forwards an override while resuming', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-codex-model-'));
  runWithWindowId('stale-window', () => setCurrentFolder(folder));
  runWithWindowId('resume-window', () => setCurrentFolder(folder));
  t.after(() => { runWithWindowId('stale-window', () => clearCurrentFolder()); runWithWindowId('resume-window', () => clearCurrentFolder()); fs.rmSync(folder, { recursive: true, force: true }); });

  const staleWs = new FakeWebSocket();
  const staleNative = catalogProcess();
  const stale = new CodexSession(staleWs as unknown as WebSocket, 'stale-window', undefined, undefined, undefined, 'withdrawn-model', undefined, () => staleNative.proc as unknown as ChildProcessWithoutNullStreams);
  stale.begin();
  await settle();
  const staleModels = staleWs.sent.map((item) => JSON.parse(item) as { t: string; fallback?: string }).find((event) => event.t === 'models');
  assert.match(staleModels?.fallback ?? '', /no longer available/);
  staleWs.emit('message', JSON.stringify({ t: 'prompt', text: 'hello' }));
  await settle();
  assert.equal('model' in (staleNative.requests.find((request) => request.method === 'turn/start')?.params ?? {}), false);
  stale.dispose();

  const resumeWs = new FakeWebSocket();
  const resumeNative = catalogProcess();
  const resumed = new CodexSession(resumeWs as unknown as WebSocket, 'resume-window', undefined, 'thread-old', undefined, 'native-model', undefined, () => resumeNative.proc as unknown as ChildProcessWithoutNullStreams);
  resumed.begin();
  await settle();
  const resumedModels = resumeWs.sent.map((item) => JSON.parse(item) as { t: string; activeModel?: string }).filter((event) => event.t === 'models').at(-1);
  assert.equal(resumedModels?.activeModel, 'resumed-model');
  resumeWs.emit('message', JSON.stringify({ t: 'prompt', text: 'continue' }));
  await settle();
  assert.equal(resumeNative.requests.some((request) => request.method === 'thread/resume'), true);
  assert.equal('model' in (resumeNative.requests.find((request) => request.method === 'turn/start')?.params ?? {}), false);
  resumed.dispose();
});

test('Codex RPC peer correlates responses and dispatches inbound messages', async () => {
  const writes: string[] = [];
  const requests: string[] = [];
  const notifications: string[] = [];
  const peer = new CodexRpcPeer((line) => writes.push(line), {
    onRequest: ({ method }) => requests.push(method),
    onNotification: (method) => notifications.push(method),
  });

  const pending = peer.request('thread/read', { threadId: 'thread-123' });
  const request = JSON.parse(writes[0]!) as { id: number };
  peer.receiveLine(JSON.stringify({ id: request.id, result: { ok: true } }));
  peer.receiveLine(JSON.stringify({ id: 99, method: 'approval/request', params: {} }));
  peer.receiveLine(JSON.stringify({ method: 'turn/started', params: {} }));

  assert.deepEqual(await pending, { ok: true });
  assert.deepEqual(requests, ['approval/request']);
  assert.deepEqual(notifications, ['turn/started']);
});

test('Codex RPC peer rejects pending work when its owner closes', async () => {
  const peer = new CodexRpcPeer(() => {});
  const pending = peer.request('turn/start', {});
  peer.close(new Error('session closed'));
  await assert.rejects(pending, /session closed/);
});

test('stale Codex process events and stdout cannot affect a replacement generation', (t) => {
  t.after(() => clearAgentRuntimeFailure('codex'));
  const first = new FakeCodexProcess();
  const second = new FakeCodexProcess();
  const processes = [first, second];
  const session = new CodexSession(
    new FakeWebSocket() as unknown as WebSocket,
    'test-window',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    () => processes.shift() as unknown as ChildProcessWithoutNullStreams,
  );
  const runtime = session as unknown as {
    spawnAppServer(cwd: string): void;
    proc: ChildProcessWithoutNullStreams | null;
    rpc: CodexRpcPeer | null;
    busy: boolean;
    activeTurnId: string | null;
  };

  runtime.spawnAppServer(os.tmpdir());
  const staleRpc = runtime.rpc;
  first.emit('error', new Error('first process failed'));
  runtime.spawnAppServer(os.tmpdir());
  const replacementRpc = runtime.rpc;
  runtime.busy = true;
  runtime.activeTurnId = 'replacement-turn';

  staleRpc?.receiveLine(JSON.stringify({
    method: 'turn/completed',
    params: { turn: { id: 'stale-turn', status: 'completed' } },
  }));

  first.emit('close', 1, null);

  assert.equal(runtime.proc, second as unknown as ChildProcessWithoutNullStreams);
  assert.equal(runtime.rpc, replacementRpc);
  assert.equal(runtime.busy, true);
  assert.equal(runtime.activeTurnId, 'replacement-turn');
  session.dispose();
  assert.equal(second.killed, true);
});

test('closed Codex RPC peers ignore inbound requests and notifications', () => {
  const received: string[] = [];
  const peer = new CodexRpcPeer(() => {}, {
    onRequest: ({ method }) => received.push(method),
    onNotification: (method) => received.push(method),
  });

  peer.close();
  peer.receiveLine(JSON.stringify({ id: 1, method: 'approval/request', params: {} }));
  peer.receiveLine(JSON.stringify({ method: 'turn/completed', params: {} }));

  assert.deepEqual(received, []);
});

test('Codex Delete Chat uses the native irreversible thread/delete operation', async () => {
  const requests: Array<{ method: string; params: unknown }> = [];

  await permanentlyDeleteCodexThread(async (method, params) => {
    requests.push({ method, params });
  }, 'thread-123');

  assert.deepEqual(requests, [{ method: 'thread/delete', params: { threadId: 'thread-123' } }]);
});

test('Codex Edit keeps native approval requests enabled for sensitive actions', () => {
  assert.deepEqual(codexAccessOptions('acceptEdits'), {
    approvalPolicy: 'on-request',
    approvalsReviewer: 'user',
    sandbox: 'workspace-write',
  });
});

test('Codex Edit auto-accepts only physical file-change grants inside the open folder', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-codex-'));
  const folder = path.join(root, 'project');
  const outside = path.join(root, 'other');
  fs.mkdirSync(folder);
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(folder, 'linked-outside'));
  try {
    assert.equal(isWorkspaceFileChange({ grantRoot: path.join(folder, 'src') }, folder), true);
    assert.equal(isWorkspaceFileChange({ grantRoot: folder }, folder), true);
    assert.equal(isWorkspaceFileChange({ grantRoot: outside }, folder), false);
    assert.equal(isWorkspaceFileChange({ grantRoot: root }, folder), false);
    assert.equal(isWorkspaceFileChange({ grantRoot: path.join(folder, 'linked-outside') }, folder), false);
    assert.equal(isWorkspaceFileChange({}, folder), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Codex Edit auto-accepts only ordinary StashBase MCP writes inside the open folder', () => {
  const folder = '/workspace/project';
  const approval = (tool: string, target: string, server = 'stashbase') => ({
    input: { server, tool, arguments: { path: target } },
  });

  assert.equal(isStashbaseWorkspaceEdit(approval('edit_file', '/workspace/project/note.md'), folder), true);
  assert.equal(isStashbaseWorkspaceEdit(approval('write_file', '/workspace/project/new.md'), folder), true);
  assert.equal(isStashbaseWorkspaceEdit(approval('delete_file', '/workspace/project/note.md'), folder), false);
  assert.equal(isStashbaseWorkspaceEdit(approval('edit_file', '/workspace/other/note.md'), folder), false);
  assert.equal(isStashbaseWorkspaceEdit(approval('edit_file', '/workspace/project/note.md', 'other'), folder), false);
});
