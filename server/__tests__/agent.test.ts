import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { WebSocket } from 'ws';
import {
  AgentSession,
  ClaudeNativeSessionOwnership,
  claudeActiveModelEvent,
  claudeModelCatalogFailureEvent,
  claudePermissionMode,
  claudeSkillCatalogEvent,
  claudeSkillPrompt,
  selectClaudeModel,
} from '../agent.ts';
import { clearAgentRuntimeFailure } from '../agent-contract.ts';
import { clearCurrentFolder, runWithWindowId, setCurrentFolder } from '../folder.ts';
import { claudeTranscriptEffort } from '../routes/sessions.ts';

class FakeAgentWebSocket extends EventEmitter {
  readyState = 1;
  sent: string[] = [];
  send(value: string): void { this.sent.push(value); }
  close(): void { this.readyState = 3; this.emit('close'); }
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function fakeClaudeQuery(failureOrMessages?: Error | SDKMessage[], failure?: Error): Query {
  return {
    async *[Symbol.asyncIterator]() {
      if (Array.isArray(failureOrMessages)) {
        for (const msg of failureOrMessages) {
          yield msg;
        }
      }
      const err = failure ?? (failureOrMessages instanceof Error ? failureOrMessages : undefined);
      if (err) throw err;
    },
    supportedModels: async () => [],
    supportedCommands: async () => [],
    setModel: async () => {},
    setPermissionMode: async () => {},
    interrupt: async () => {},
  } as unknown as Query;
}

test('Claude adapter preserves supported Shared Agent Contract access modes', () => {
  assert.equal(claudePermissionMode('default'), 'default');
  assert.equal(claudePermissionMode('acceptEdits'), 'acceptEdits');
  assert.equal(claudePermissionMode('plan'), 'plan');
  assert.equal(claudePermissionMode('auto'), 'auto');
});

test('Claude adapter defaults invalid access modes to Ask', () => {
  assert.equal(claudePermissionMode(), 'default');
  assert.equal(claudePermissionMode('bypassPermissions'), 'default');
});

test('Claude replay recovers Max from the latest active transcript chain', () => {
  assert.equal(claudeTranscriptEffort([
    { type: 'assistant', uuid: 'a1', parentUuid: null, message: { effort: 'high' } },
    { type: 'user', uuid: 'u2', parentUuid: 'a1', message: {} },
    { type: 'assistant', uuid: 'a2', parentUuid: 'u2', effort: 'max', message: {} },
  ], [
    { type: 'assistant', uuid: 'a1' },
    { type: 'user', uuid: 'u2' },
    { type: 'assistant', uuid: 'a2' },
  ]), 'max');
});

test('Claude replay ignores newer sidechain effort metadata', () => {
  assert.equal(claudeTranscriptEffort([
    { type: 'assistant', uuid: 'active', parentUuid: null, message: { effort: 'max' } },
    { type: 'assistant', uuid: 'branch', parentUuid: null, isSidechain: true, message: { effort: 'high' } },
    { type: 'user', uuid: 'leaf', parentUuid: 'active', message: {} },
  ], [
    { type: 'assistant', uuid: 'active' },
    { type: 'user', uuid: 'leaf' },
  ]), 'max');
});

test('Claude replay treats missing and future effort metadata as unknown', () => {
  assert.equal(claudeTranscriptEffort([
    { type: 'assistant', uuid: 'old', parentUuid: null, message: { effort: 'max' } },
    { type: 'assistant', uuid: 'new', parentUuid: 'old', message: { effort: 'ultra' } },
  ], [
    { type: 'assistant', uuid: 'old' },
    { type: 'assistant', uuid: 'new' },
  ]), null);
  assert.equal(claudeTranscriptEffort([
    { type: 'assistant', uuid: 'only', parentUuid: null, message: {} },
  ], [{ type: 'assistant', uuid: 'only' }]), null);
});

test('Claude native ownership is active before reconnect and serializes acquisition through retirement', async () => {
  let retire!: () => void;
  const retired = new Promise<void>((resolve) => { retire = resolve; });
  let disposed = false;
  const oldSession = {
    dispose() { disposed = true; },
    retirement() { return retired; },
  } as unknown as AgentSession;
  const replacement = {} as AgentSession;
  const ownership = new ClaudeNativeSessionOwnership();
  ownership.register('native-1', oldSession);

  let acquired = false;
  const acquiring = ownership.acquire('native-1', replacement).then(() => { acquired = true; });
  await settle();
  assert.equal(disposed, true);
  assert.equal(acquired, false);
  retire();
  await acquiring;
  assert.equal(acquired, true);
});

test('Claude resume validates folder scope before acquiring native ownership', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-resume-scope-'));
  runWithWindowId('claude-resume-scope-window', () => setCurrentFolder(folder));
  t.after(() => {
    runWithWindowId('claude-resume-scope-window', () => clearCurrentFolder());
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const ws = new FakeAgentWebSocket();
  let acquired = false;
  let queryStarted = false;
  const session = new AgentSession(
    ws as unknown as WebSocket,
    'claude-resume-scope-window',
    'max',
    'native-other-folder',
    'default',
    undefined,
    undefined,
    (() => { queryStarted = true; return fakeClaudeQuery(); }) as never,
    () => '/fake/claude',
    async () => false,
  );

  session.begin(async () => { acquired = true; return true; });
  await settle();

  assert.equal(acquired, false);
  assert.equal(queryStarted, false);
  assert.equal(ws.sent.some((item) => JSON.parse(item).message === 'That session belongs to a different folder.'), true);
});

test('Claude native ownership does not retain closed acquisitions', async () => {
  let closedDisposed = 0;
  const closed = {
    isClosed: true,
    dispose() { closedDisposed += 1; },
    retirement() { return Promise.resolve(); },
  } as unknown as AgentSession;
  const ownership = new ClaudeNativeSessionOwnership();

  assert.equal(await ownership.acquire('native-closed', closed), false);

  let registeredDisposed = false;
  const registered = {
    isClosed: false,
    dispose() { registeredDisposed = true; },
    retirement() { return Promise.resolve(); },
  } as unknown as AgentSession;
  ownership.register('native-closed', registered);
  assert.equal(await ownership.acquire('native-closed', { isClosed: false } as AgentSession), true);
  assert.equal(registeredDisposed, true);
  assert.equal(closedDisposed, 0);
});

test('Claude native ownership releases every id claimed by a disposed session', async () => {
  const ownership = new ClaudeNativeSessionOwnership();
  const owner = { isClosed: false } as AgentSession;
  ownership.register('resume-id', owner);
  ownership.register('native-id', owner);
  ownership.release(owner);

  let resumeOwnerDisposed = false;
  let nativeOwnerDisposed = false;
  const resumeOwner = {
    isClosed: false,
    dispose() { resumeOwnerDisposed = true; },
    retirement() { return Promise.resolve(); },
  } as unknown as AgentSession;
  const nativeOwner = {
    isClosed: false,
    dispose() { nativeOwnerDisposed = true; },
    retirement() { return Promise.resolve(); },
  } as unknown as AgentSession;
  ownership.register('resume-id', resumeOwner);
  ownership.register('native-id', nativeOwner);

  assert.equal(await ownership.acquire('resume-id', { isClosed: false } as AgentSession), true);
  assert.equal(await ownership.acquire('native-id', { isClosed: false } as AgentSession), true);
  assert.equal(resumeOwnerDisposed, true);
  assert.equal(nativeOwnerDisposed, true);
});

test('Claude retirement waits for the SDK stream to exit after interrupt acknowledgement', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-retire-'));
  runWithWindowId('claude-retire-window', () => setCurrentFolder(folder));
  t.after(() => {
    runWithWindowId('claude-retire-window', () => clearCurrentFolder());
    fs.rmSync(folder, { recursive: true, force: true });
  });
  let finishStream!: () => void;
  const streamGate = new Promise<void>((resolve) => { finishStream = resolve; });
  async function* stream() {
    yield { type: 'system', subtype: 'init', session_id: 'native-retire', model: 'native-model' } as never;
    await streamGate;
  }
  const native = Object.assign(stream(), {
    supportedModels: async () => [],
    supportedCommands: async () => [],
    setModel: async () => {},
    setPermissionMode: async () => {},
    interrupt: async () => {},
  }) as unknown as Query;
  const ws = new FakeAgentWebSocket();
  let retirement: Promise<void> | undefined;
  const session = new AgentSession(
    ws as unknown as WebSocket,
    'claude-retire-window',
    undefined,
    undefined,
    'default',
    undefined,
    (_session, pending) => { retirement = pending; },
    (() => native) as never,
    () => '/fake/claude',
  );
  session.begin();
  await settle();
  session.dispose();
  await settle();
  assert.ok(retirement);
  let retired = false;
  void retirement.then(() => { retired = true; });
  await settle();
  assert.equal(retired, false);
  finishStream();
  await retirement;
  assert.equal(retired, true);
});

test('Claude model selection recovers visibly when the SDK rejects a discovered model', async () => {
  const calls: Array<string | undefined> = [];
  const result = await selectClaudeModel('native-model', [{ id: 'native-model', label: 'Native model' }], async (model) => {
    calls.push(model);
    throw new Error('model withdrawn');
  }, false);
  assert.deepEqual(calls, ['native-model']);
  assert.match(result.fallback ?? '', /could not be selected/);
});

test('Claude resume preserves the native model and waits for its init event', async () => {
  let called = false;
  const result = await selectClaudeModel('old-tab-model', [{ id: 'old-tab-model', label: 'Old tab model' }], async () => { called = true; }, true);
  assert.equal(called, false);
  assert.equal(result.fallback, undefined);
});

test('Claude init-event model becomes the visible active model, including a runtime alias absent from discovery', () => {
  const event = claudeActiveModelEvent([{ id: 'sonnet', label: 'Sonnet' }], 'claude-sonnet-native');
  assert.equal(event.activeModel, 'claude-sonnet-native');
  assert.deepEqual(event.models.at(-1), { id: 'claude-sonnet-native', label: 'claude-sonnet-native' });
});

test('Claude catalog failure clears an unverifiable fresh selection with a visible fallback', () => {
  const event = claudeModelCatalogFailureEvent('claude-opus-native', false);
  assert.deepEqual(event.models, []);
  assert.match(event.fallback ?? '', /runtime default/);
});

test('Claude catalog failure does not claim a fallback for a resumed native session', () => {
  const event = claudeModelCatalogFailureEvent('stale-tab-model', true);
  assert.deepEqual(event.models, []);
  assert.equal(event.fallback, undefined);
});

test('Claude publishes single-slash skill labels and sends the selected native command', () => {
  const event = claudeSkillCatalogEvent([{ name: 'release-notes', description: 'Prepare release notes', argumentHint: '<version>' }]);
  assert.deepEqual(event, {
    t: 'skills',
    state: 'available',
    skills: [{ id: 'release-notes', label: 'release-notes', description: 'Prepare release notes', argumentHint: '<version>' }],
  });
  assert.equal(claudeSkillPrompt('prepare the release', 'release-notes'), '/release-notes prepare the release');
  assert.deepEqual(claudeSkillCatalogEvent([]), { t: 'skills', state: 'empty', skills: [] });
});

test('Claude unexpected iterator EOF after ready emits one useful fatal exit', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-exit-'));
  runWithWindowId('claude-eof-window', () => setCurrentFolder(folder));
  t.after(() => {
    clearAgentRuntimeFailure('claude');
    runWithWindowId('claude-eof-window', () => clearCurrentFolder());
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const ws = new FakeAgentWebSocket();
  const session = new AgentSession(
    ws as unknown as WebSocket,
    'claude-eof-window',
    undefined,
    undefined,
    'default',
    undefined,
    undefined,
    (() => fakeClaudeQuery()) as never,
    () => '/fake/claude',
  );
  session.begin();
  await settle();

  const events = ws.sent.map((value) => JSON.parse(value) as { t: string; message?: string });
  assert.equal(events.some((event) => event.t === 'ready'), true);
  assert.deepEqual(events.filter((event) => event.t === 'exit'), [
    { t: 'exit', message: 'Claude session ended unexpectedly.' },
  ]);
  assert.equal(events.some((event) => event.t === 'error'), false);
});

test('Claude iterator rejection after ready emits its cause once without a duplicate error', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-exit-'));
  runWithWindowId('claude-failure-window', () => setCurrentFolder(folder));
  t.after(() => {
    clearAgentRuntimeFailure('claude');
    runWithWindowId('claude-failure-window', () => clearCurrentFolder());
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const ws = new FakeAgentWebSocket();
  const session = new AgentSession(
    ws as unknown as WebSocket,
    'claude-failure-window',
    undefined,
    undefined,
    'default',
    undefined,
    undefined,
    (() => fakeClaudeQuery(new Error('Claude stream failed.'))) as never,
    () => '/fake/claude',
  );
  session.begin();
  await settle();

  const events = ws.sent.map((value) => JSON.parse(value) as { t: string; message?: string });
  assert.deepEqual(events.filter((event) => event.t === 'exit'), [
    { t: 'exit', message: 'Claude stream failed.' },
  ]);
  assert.equal(events.some((event) => event.t === 'error'), false);
});

test('Claude startup failure puts its cause on the terminal exit', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-exit-'));
  runWithWindowId('claude-startup-window', () => setCurrentFolder(folder));
  t.after(() => {
    runWithWindowId('claude-startup-window', () => clearCurrentFolder());
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const ws = new FakeAgentWebSocket();
  const session = new AgentSession(
    ws as unknown as WebSocket,
    'claude-startup-window',
    undefined,
    undefined,
    'default',
    undefined,
    undefined,
    (() => fakeClaudeQuery()) as never,
    () => null,
  );
  session.begin();
  await settle();

  const events = ws.sent.map((value) => JSON.parse(value) as { t: string; message?: string });
  assert.equal(events.some((event) => event.t === 'ready'), false);
  assert.equal(events.some((event) => event.t === 'error'), false);
  assert.match(events.find((event) => event.t === 'exit')?.message ?? '', /Claude CLI not found/);
});

test('Claude Session final result with errors preserves and truncates messages', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-err-preserve-'));
  runWithWindowId('claude-err-preserve-window', () => setCurrentFolder(folder));
  t.after(() => {
    clearAgentRuntimeFailure('claude');
    runWithWindowId('claude-err-preserve-window', () => clearCurrentFolder());
    fs.rmSync(folder, { recursive: true, force: true });
  });

  const ws = new FakeAgentWebSocket();
  const mockMessages: SDKMessage[] = [
    {
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      errors: ['Request timed out', 'Request timed out  ', 'Network unreachable'],
      duration_ms: 100,
      duration_api_ms: 50,
      num_turns: 1,
      stop_reason: 'error',
      total_cost_usd: 0.01,
      usage: { input_tokens: 10, output_tokens: 5 } as any,
      modelUsage: {},
      permission_denials: [],
      uuid: 'msg-123' as any,
      session_id: 'session-123',
    },
  ];

  const session = new AgentSession(
    ws as unknown as WebSocket,
    'claude-err-preserve-window',
    undefined,
    undefined,
    'default',
    undefined,
    undefined,
    (() => fakeClaudeQuery(mockMessages)) as never,
    () => '/fake/claude',
  );
  session.begin();
  await settle();

  const events = ws.sent.map((value) => JSON.parse(value) as { t: string; message?: string; isError?: boolean });
  
  // Verify error event contains deduplicated, joined message
  const errorEvent = events.find((e) => e.t === 'error');
  assert.ok(errorEvent);
  assert.equal(errorEvent.message, 'Request timed out; Network unreachable');

  // Verify turn-end event isError is true
  const turnEndEvent = events.find((e) => e.t === 'turn-end');
  assert.ok(turnEndEvent);
  assert.equal(turnEndEvent.isError, true);
});

test('Claude Session final result with no error text uses subtype fallbacks', async (t) => {
  const subtypes = [
    'error_max_turns',
    'error_max_budget_usd',
    'error_max_structured_output_retries',
    'error_during_execution',
  ] as const;
  const expectedMessages = [
    'Claude stopped after reaching the maximum number of turns.',
    'Claude stopped after reaching the configured budget.',
    'Claude could not produce the requested structured response.',
    'Claude failed before completing the turn.',
  ];

  for (let i = 0; i < subtypes.length; i++) {
    const subtype = subtypes[i]!;
    const expected = expectedMessages[i]!;

    const folder = fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-claude-fallback-${i}-`));
    runWithWindowId(`claude-fallback-window-${i}`, () => setCurrentFolder(folder));
    t.after(() => {
      clearAgentRuntimeFailure('claude');
      runWithWindowId(`claude-fallback-window-${i}`, () => clearCurrentFolder());
      fs.rmSync(folder, { recursive: true, force: true });
    });

    const ws = new FakeAgentWebSocket();
    const mockMessages: SDKMessage[] = [
      {
        type: 'result',
        subtype,
        is_error: true,
        errors: [],
        duration_ms: 100,
        duration_api_ms: 50,
        num_turns: 1,
        stop_reason: 'error',
        total_cost_usd: 0.01,
        usage: { input_tokens: 10, output_tokens: 5 } as any,
        modelUsage: {},
        permission_denials: [],
        uuid: 'msg-123' as any,
        session_id: 'session-123',
      },
    ];

    const session = new AgentSession(
      ws as unknown as WebSocket,
      `claude-fallback-window-${i}`,
      undefined,
      undefined,
      'default',
      undefined,
      undefined,
      (() => fakeClaudeQuery(mockMessages)) as never,
      () => '/fake/claude',
    );
    session.begin();
    await settle();

    const events = ws.sent.map((value) => JSON.parse(value) as { t: string; message?: string });
    const errorEvent = events.find((e) => e.t === 'error');
    assert.ok(errorEvent, `Expected error event for subtype ${subtype}`);
    assert.equal(errorEvent.message, expected);
  }
});

test('Claude Session handles transient api_retry warnings without permanent errors', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-retry-'));
  runWithWindowId('claude-retry-window', () => setCurrentFolder(folder));
  t.after(() => {
    clearAgentRuntimeFailure('claude');
    runWithWindowId('claude-retry-window', () => clearCurrentFolder());
    fs.rmSync(folder, { recursive: true, force: true });
  });

  const ws = new FakeAgentWebSocket();
  const mockMessages: SDKMessage[] = [
    {
      type: 'system',
      subtype: 'api_retry',
      attempt: 1,
      max_retries: 3,
      retry_delay_ms: 1000,
      error_status: null,
      error: 'unknown',
      uuid: 'retry-uuid' as any,
      session_id: 'session-123',
    },
    {
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 100,
      duration_api_ms: 50,
      num_turns: 1,
      result: 'Hello output',
      stop_reason: 'end_turn',
      total_cost_usd: 0.01,
      usage: { input_tokens: 10, output_tokens: 5 } as any,
      modelUsage: {},
      permission_denials: [],
      uuid: 'msg-123' as any,
      session_id: 'session-123',
    },
  ];

  const session = new AgentSession(
    ws as unknown as WebSocket,
    'claude-retry-window',
    undefined,
    undefined,
    'default',
    undefined,
    undefined,
    (() => fakeClaudeQuery(mockMessages)) as never,
    () => '/fake/claude',
  );
  session.begin();
  await settle();

  const events = ws.sent.map((value) => JSON.parse(value) as { t: string });
  // Verify api_retry did not emit error to client, and turn finishes successfully
  assert.equal(events.some((e) => e.t === 'error'), false);
  const turnEndEvent = events.find((e) => e.t === 'turn-end');
  assert.ok(turnEndEvent);
  assert.equal((turnEndEvent as any).isError, false);
});

test('Claude Session handles api_retry followed by terminal failure', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-retry-fail-'));
  runWithWindowId('claude-retry-fail-window', () => setCurrentFolder(folder));
  t.after(() => {
    clearAgentRuntimeFailure('claude');
    runWithWindowId('claude-retry-fail-window', () => clearCurrentFolder());
    fs.rmSync(folder, { recursive: true, force: true });
  });

  const ws = new FakeAgentWebSocket();
  const mockMessages: SDKMessage[] = [
    {
      type: 'system',
      subtype: 'api_retry',
      attempt: 1,
      max_retries: 3,
      retry_delay_ms: 1000,
      error_status: null,
      error: 'unknown',
      uuid: 'retry-uuid' as any,
      session_id: 'session-123',
    },
    {
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      errors: ['Request timed out'],
      duration_ms: 100,
      duration_api_ms: 50,
      num_turns: 1,
      stop_reason: 'error',
      total_cost_usd: 0.01,
      usage: { input_tokens: 10, output_tokens: 5 } as any,
      modelUsage: {},
      permission_denials: [],
      uuid: 'msg-123' as any,
      session_id: 'session-123',
    },
  ];

  const session = new AgentSession(
    ws as unknown as WebSocket,
    'claude-retry-fail-window',
    undefined,
    undefined,
    'default',
    undefined,
    undefined,
    (() => fakeClaudeQuery(mockMessages)) as never,
    () => '/fake/claude',
  );
  session.begin();
  await settle();

  const events = ws.sent.map((value) => JSON.parse(value) as { t: string; message?: string; isError?: boolean });
  // Verify only one final error message and a failed turn-end are emitted
  const errorEvents = events.filter((e) => e.t === 'error');
  assert.equal(errorEvents.length, 1);
  assert.equal(errorEvents[0]?.message, 'Request timed out');

  const turnEndEvent = events.find((e) => e.t === 'turn-end');
  assert.ok(turnEndEvent);
  assert.equal(turnEndEvent.isError, true);
});

test('Claude Session user cancellation returns non-red turn-end', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-cancel-'));
  runWithWindowId('claude-cancel-window', () => setCurrentFolder(folder));
  t.after(() => {
    clearAgentRuntimeFailure('claude');
    runWithWindowId('claude-cancel-window', () => clearCurrentFolder());
    fs.rmSync(folder, { recursive: true, force: true });
  });

  const ws = new FakeAgentWebSocket();
  let triggerResult: (() => void) | null = null;
  const resultPromise = new Promise<void>((resolve) => {
    triggerResult = resolve;
  });

  const queryFactory = () => {
    return {
      async *[Symbol.asyncIterator]() {
        await resultPromise;
        yield {
          type: 'result',
          subtype: 'error_during_execution',
          is_error: true,
          errors: ['Interrupted by user'],
          duration_ms: 100,
          duration_api_ms: 50,
          num_turns: 1,
          stop_reason: 'error',
          total_cost_usd: 0.01,
          usage: { input_tokens: 10, output_tokens: 5 } as any,
          modelUsage: {},
          permission_denials: [],
          uuid: 'msg-123' as any,
          session_id: 'session-123',
        };
      },
      supportedModels: async () => [],
      supportedCommands: async () => [],
      setModel: async () => {},
      setPermissionMode: async () => {},
      interrupt: async () => {},
    } as unknown as Query;
  };

  const session = new AgentSession(
    ws as unknown as WebSocket,
    'claude-cancel-window',
    undefined,
    undefined,
    'default',
    undefined,
    undefined,
    queryFactory as any,
    () => '/fake/claude',
  );
  session.begin();
  await settle();

  // Send prompt
  ws.emit('message', JSON.stringify({ t: 'prompt', text: 'run query' }));
  await settle();

  // Send interrupt client event
  ws.emit('message', JSON.stringify({ t: 'interrupt' }));
  await settle();

  // Trigger the result
  triggerResult!();
  await settle();

  const events = ws.sent.map((value) => JSON.parse(value) as { t: string; message?: string; isError?: boolean });
  
  // Verify client received turn-end with isError: false, and no error message
  assert.equal(events.some((e) => e.t === 'error'), false);
  const turnEndEvent = events.find((e) => e.t === 'turn-end');
  assert.ok(turnEndEvent);
  assert.equal(turnEndEvent.isError, false);
});
