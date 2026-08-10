import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import type { WebSocket } from 'ws';
import { registerAgentAdapter, type AgentHistoryActions } from '../agent-contract.ts';
import * as sharedRoutes from '../routes/agent-sessions.ts';
import * as legacyRoutes from '../routes/sessions.ts';

async function invoke(app: express.Express, path: string, params: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const layer = (app as any)._router.stack.find((entry: any) => entry.route?.path === path);
  assert.ok(layer, `route ${path} mounted`);
  return new Promise((resolve, reject) => {
    let status = 200;
    const res = {
      status(code: number) { status = code; return this; },
      json(body: unknown) { resolve({ status, body }); return this; },
    };
    Promise.resolve(layer.route.stack[0].handle({ params, query: {}, body: {} }, res, reject)).catch(reject);
  });
}

test('shared replay adds metadata without changing shared or legacy messages responses', async () => {
  const messages = [{ kind: 'assistant', id: 'h0', text: 'persisted' }];
  const history: AgentHistoryActions = {
    list: async () => [],
    messages: async () => messages,
    replay: async () => ({ protocol: 2, messages, effort: 'max' }),
    rename: async () => ({}),
    remove: async () => {},
  };
  registerAgentAdapter({
    id: 'claude',
    label: 'Claude Code',
    vendor: 'Anthropic',
    capabilities: {
      connection: true, prompts: true, interrupt: true, transcript: true,
      approvals: true, history: true, modes: true, effort: true, models: true,
      skills: true, steering: false, titleHint: false,
    },
    attach: (_ws: WebSocket) => {},
    stop: () => {},
    stopFolder: () => {},
    history,
  });

  const app = express();
  sharedRoutes.mount(app);
  legacyRoutes.mount(app);

  assert.deepEqual(await invoke(app, '/api/agents/:agent/sessions/:id/replay', { agent: 'claude', id: 's1' }),
    { status: 200, body: { protocol: 2, messages, effort: 'max' } });
  assert.deepEqual(await invoke(app, '/api/agents/:agent/sessions/:id/messages', { agent: 'claude', id: 's1' }),
    { status: 200, body: messages });
  assert.deepEqual(await invoke(app, '/api/agent/sessions/:id/messages', { id: 's1' }),
    { status: 200, body: messages });
});

test('shared replay reports unavailable metadata without weakening messages compatibility', async () => {
  const messages = [{ kind: 'assistant', id: 'h0', text: 'legacy' }];
  registerAgentAdapter({
    id: 'codex',
    label: 'Codex',
    vendor: 'OpenAI',
    capabilities: {
      connection: true, prompts: true, interrupt: true, transcript: true,
      approvals: true, history: true, modes: true, effort: true, models: true,
      skills: true, steering: true, titleHint: true,
    },
    attach: (_ws: WebSocket) => {},
    stop: () => {},
    stopFolder: () => {},
    history: {
      list: async () => [],
      messages: async () => messages,
      rename: async () => ({}),
      remove: async () => {},
    },
  });
  const app = express();
  sharedRoutes.mount(app);

  assert.deepEqual(await invoke(app, '/api/agents/:agent/sessions/:id/replay', { agent: 'codex', id: 's1' }),
    { status: 404, body: { error: 'replay metadata unavailable' } });
  assert.deepEqual(await invoke(app, '/api/agents/:agent/sessions/:id/messages', { agent: 'codex', id: 's1' }),
    { status: 200, body: messages });
});

test('production Claude replay joins SDK-selected active UUIDs to raw JSONL effort metadata', async (t) => {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-claude-history-'));
  const project = path.join(config, 'projects', '-workspace');
  const sessionId = '11111111-1111-4111-8111-111111111111';
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, `${sessionId}.jsonl`), [
    JSON.stringify({
      type: 'assistant', uuid: 'active-max', sessionId, parentUuid: null,
      isSidechain: false, effort: 'max',
      message: { role: 'assistant', content: [{ type: 'text', text: 'active answer' }] },
    }),
    JSON.stringify({
      type: 'assistant', uuid: 'stale-sidechain', sessionId, parentUuid: null,
      isSidechain: true, effort: 'high',
      message: { role: 'assistant', content: [{ type: 'text', text: 'stale answer' }] },
    }),
    '',
  ].join('\n'));
  const previousConfig = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = config;
  t.after(() => {
    if (previousConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = previousConfig;
    fs.rmSync(config, { recursive: true, force: true });
  });

  // This is the SDK's real sanitized SessionMessage shape: the active-chain
  // selector retained UUID/type/message but removed parent/sidechain/effort.
  const sanitized = [{
    type: 'assistant' as const,
    uuid: 'active-max',
    session_id: sessionId,
    message: { role: 'assistant', content: [{ type: 'text', text: 'active answer' }] },
    parent_tool_use_id: null,
  }];
  const history = legacyRoutes.claudeHistoryActions({
    belongsToFolder: async () => true,
    getMessages: async () => sanitized,
  });
  assert.deepEqual(await history.replay!(sessionId, '/workspace'), {
    protocol: 2,
    messages: [{ kind: 'assistant', id: 'h0', text: 'active answer' }],
    effort: 'max',
  });
});
