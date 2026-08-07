import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Query } from '@anthropic-ai/claude-agent-sdk';
import type { WebSocket } from 'ws';
import {
  AgentSession,
  claudeActiveModelEvent,
  claudeModelCatalogFailureEvent,
  claudePermissionMode,
  claudeSkillCatalogEvent,
  claudeSkillPrompt,
  selectClaudeModel,
} from '../agent.ts';
import { clearAgentRuntimeFailure } from '../agent-contract.ts';
import { clearCurrentFolder, runWithWindowId, setCurrentFolder } from '../folder.ts';

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

function fakeClaudeQuery(failure?: Error): Query {
  return {
    async *[Symbol.asyncIterator]() {
      if (failure) throw failure;
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
