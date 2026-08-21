import assert from 'node:assert/strict';
import test from 'node:test';
import type { Event } from '@opencode-ai/sdk';
import { OpenCodeEventTranslator } from '../opencode-agent.ts';
import { buildOpenCodeConfig } from '../opencode-runtime.ts';

test('bundled OpenCode config disables sharing and updates while asking for every risky local action', () => {
  const config = buildOpenCodeConfig({
    apiKey: 'loopback-secret', baseUrl: 'http://127.0.0.1:1234/v1', model: 'stashbase-agent-default',
  }, '/private/stashbase-mcp');
  assert.equal(config.autoupdate, false);
  assert.equal(config.share, 'disabled');
  assert.deepEqual(config.enabled_providers, ['stashbase']);
  assert.equal(config.permission?.edit, 'ask');
  assert.equal(config.permission?.bash, 'ask');
  assert.equal(config.permission?.external_directory, 'deny');
  const libraryTools = config.agent?.['stashbase-library']?.tools ?? {};
  for (const tool of ['read', 'write', 'edit', 'patch', 'apply_patch', 'glob', 'grep', 'bash', 'task']) {
    assert.equal(libraryTools[tool], false, `Library profile must deny ${tool}`);
  }
  assert.equal(config.agent?.['stashbase-folder']?.tools, undefined);
  assert.equal(config.agent?.['stashbase-library']?.permission?.edit, 'deny');
  assert.equal(config.agent?.['stashbase-library']?.permission?.bash, 'deny');
  assert.equal(config.agent?.['stashbase-folder']?.mode, 'primary');
  assert.equal((config.permission as Record<string, unknown>).stashbase_write_file, 'ask');
  assert.equal((config.permission as Record<string, unknown>).stashbase_delete_file, 'ask');
  assert.equal((config.permission as Record<string, unknown>).stashbase_create_project, 'ask');
  assert.deepEqual(config.mcp?.stashbase, {
    type: 'local', command: ['/private/stashbase-mcp'], enabled: true, timeout: 10_000,
  });
  assert.equal(config.provider?.stashbase.options?.apiKey, 'loopback-secret');
  assert.equal(config.provider?.stashbase.options?.baseURL, 'http://127.0.0.1:1234/v1');

  const attributed = buildOpenCodeConfig({
    apiKey: 'loopback-secret', baseUrl: 'http://127.0.0.1:1234/v1', model: 'stashbase-agent-default',
  }, '/private/stashbase-mcp', { STASHBASE_WINDOW_ID: 'window-1', STASHBASE_AGENT_SESSION_ID: 'session-1' }, 'Use StashBase tools.');
  assert.deepEqual(attributed.mcp?.stashbase, {
    type: 'local',
    command: ['/private/stashbase-mcp'],
    environment: { STASHBASE_WINDOW_ID: 'window-1', STASHBASE_AGENT_SESSION_ID: 'session-1' },
    enabled: true,
    timeout: 10_000,
  });
  assert.equal(attributed.agent?.['stashbase-folder']?.prompt, 'Use StashBase tools.');
  assert.equal(attributed.agent?.['stashbase-library']?.prompt, 'Use StashBase tools.');
});

test('OpenCode events normalize into the Shared Agent Contract without duplicate cumulative content', () => {
  const translator = new OpenCodeEventTranslator();
  translator.bindSession('session-1');
  assert.deepEqual(translator.beginTurn(), [{ t: 'turn-start' }]);

  const text = (value: string, delta?: string) => translator.translate({
    type: 'message.part.updated',
    properties: {
      part: { id: 'part-1', sessionID: 'session-1', messageID: 'message-1', type: 'text', text: value },
      ...(delta == null ? {} : { delta }),
    },
  });
  assert.deepEqual(text('Hel'), [{ t: 'text', delta: 'Hel' }]);
  assert.deepEqual(text('Hello'), [{ t: 'text', delta: 'lo' }]);
  assert.deepEqual(text('Hello!', '!'), [{ t: 'text', delta: '!' }]);

  const pending: Event = {
    type: 'message.part.updated',
    properties: {
      part: {
        id: 'tool-part', sessionID: 'session-1', messageID: 'message-1', type: 'tool',
        callID: 'call-1', tool: 'read',
        state: { status: 'pending', input: {}, raw: '{"path":' },
      },
    },
  };
  assert.deepEqual(translator.translate(pending), []);

  const running: Event = {
    type: 'message.part.updated',
    properties: {
      part: {
        id: 'tool-part', sessionID: 'session-1', messageID: 'message-1', type: 'tool',
        callID: 'call-1', tool: 'read',
        state: { status: 'running', input: { path: 'notes.md' }, time: { start: 1 } },
      },
    },
  };
  assert.deepEqual(translator.translate(running), [
    { t: 'tool', id: 'call-1', name: 'Read', input: { path: 'notes.md' } },
  ]);
  assert.deepEqual(translator.translate(running), []);

  assert.deepEqual(translator.translate({
    type: 'message.part.updated',
    properties: {
      part: {
        id: 'tool-part', sessionID: 'session-1', messageID: 'message-1', type: 'tool',
        callID: 'call-1', tool: 'read',
        state: {
          status: 'completed', input: { path: 'notes.md' }, output: 'contents', title: 'Read notes.md',
          metadata: {}, time: { start: 1, end: 2 },
        },
      },
    },
  }), [{ t: 'tool-result', id: 'call-1', content: 'contents', isError: false }]);

  assert.deepEqual(translator.translate({
    type: 'permission.updated',
    properties: {
      id: 'permission-1', sessionID: 'session-1', messageID: 'message-1', callID: 'call-1',
      type: 'bash', title: 'Run command?', metadata: { command: 'pwd' }, time: { created: 1 },
    },
  }), [{
    t: 'permission', id: 'permission-1', toolUseId: 'call-1', name: 'Read', title: 'Run command?',
    input: { command: 'pwd' },
  }]);

  assert.deepEqual(translator.translate({
    type: 'message.part.updated',
    properties: {
      part: {
        id: 'bash-part', sessionID: 'session-1', messageID: 'message-1', type: 'tool',
        callID: 'call-2', tool: 'bash',
        state: { status: 'running', input: { command: 'pwd' }, time: { start: 1 } },
      },
    },
  }), [{ t: 'tool', id: 'call-2', name: 'Bash', input: { command: 'pwd' } }]);
  assert.deepEqual(translator.translate({
    type: 'permission.updated',
    properties: {
      id: 'permission-2', sessionID: 'session-1', messageID: 'message-1', callID: 'call-2',
      type: 'bash', title: 'Run command?', metadata: { command: 'pwd' }, time: { created: 1 },
    },
  }), [{
    t: 'permission', id: 'permission-2', toolUseId: 'call-2', name: 'Bash', title: 'Run command?',
    input: { command: 'pwd' },
  }]);

  const diff: Event = {
    type: 'session.diff',
    properties: {
      sessionID: 'session-1',
      diff: [{ file: 'notes.md', before: 'old', after: 'new', additions: 1, deletions: 1 }],
    },
  };
  assert.deepEqual(translator.translate(diff), [{
    t: 'file-diff', id: 'diff:session-1:1', file: 'notes.md', before: 'old', after: 'new', additions: 1, deletions: 1,
  }]);
  assert.deepEqual(translator.translate(diff), []);
  assert.deepEqual(translator.translate({ type: 'session.idle', properties: { sessionID: 'session-1' } }), [
    { t: 'turn-end', isError: false },
  ]);
});

test('OpenCode translator isolates sessions and classifies hosted allowance failures', () => {
  const translator = new OpenCodeEventTranslator();
  translator.bindSession('ours');
  assert.deepEqual(translator.translate({ type: 'session.idle', properties: { sessionID: 'other' } }), []);
  translator.beginTurn();
  const events = translator.translate({
    type: 'session.error',
    properties: {
      sessionID: 'ours',
      error: { name: 'APIError', data: { message: 'StashBase weekly Agent allowance exhausted', isRetryable: false } },
    },
  });
  assert.deepEqual(events, [
    { t: 'error', message: 'StashBase weekly Agent allowance exhausted', failure: { kind: 'allowance-exhausted' } },
    { t: 'turn-end', isError: true },
  ]);
});
