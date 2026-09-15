import { describe, expect, it, vi } from 'vite-plus/test';

import { idleAgentSessionPort } from '@/test/fakes/agent';
import { agentCatalogPort, CODEX_AGENT } from '@/test/fakes/agent';

import { connectAgent } from './connect-agent';
import type { AgentPreferencesPort } from './ports';
import { createAgentWorkspaceRuntime } from './workspace-runtime';

const scope = { kind: 'folder', path: '/project' } as const;
function workspace(preferences: AgentPreferencesPort) {
  let id = 0;
  return createAgentWorkspaceRuntime({
    createId: () => String(++id),
    folderPath: scope.path,
    preferences,
    port: idleAgentSessionPort(),
  });
}

describe('project Agent preferences', () => {
  it('remembers an explicit choice across new chats and restarts, isolated from other projects', async () => {
    const entries: Awaited<ReturnType<AgentPreferencesPort['load']>> = [];
    const preferences: AgentPreferencesPort = {
      load: vi.fn(async () => entries),
      save: vi.fn(async (_scope, agent) => {
        entries.push({ scope: scope.path, agent });
      }),
    };
    const first = workspace(preferences);
    await first.loadPreferences();
    first.activeSession().setDraft('Unsent work');
    await first.chooseAgent('codex');
    expect(first.activeSession().store.getState().draft).toBe('Unsent work');
    expect(first.newChat().store.getState().agent).toBe('codex');
    first.setWindowFolder('/other');
    expect(first.activeSession().store.getState().agent).toBe('stashbase');
    first.dispose();
    const reopened = workspace(preferences);
    await reopened.loadPreferences();
    expect(reopened.activeSession().store.getState().agent).toBe('codex');
    reopened.dispose();
  });
  it('exposes preference failure without overwriting a saved choice or losing work', async () => {
    const preferences: AgentPreferencesPort = {
      load: vi
        .fn()
        .mockRejectedValueOnce(new Error('Offline'))
        .mockResolvedValue([{ scope: scope.path, agent: 'claude' }]),
      save: vi.fn(async () => {
        throw new Error('Read-only');
      }),
    };
    const runtime = workspace(preferences);
    runtime.activeSession().setDraft('Keep this');
    await runtime.loadPreferences();
    expect(runtime.preferences.getState().failure).not.toBeNull();
    expect(await runtime.chooseAgent('codex')).toBe(false);
    expect(preferences.save).not.toHaveBeenCalled();
    await runtime.loadPreferences();
    expect(runtime.activeSession().store.getState().agent).toBe('claude');
    expect(await runtime.chooseAgent('codex')).toBe(false);
    expect(runtime.activeSession().store.getState()).toMatchObject({
      agent: 'claude',
      draft: 'Keep this',
    });
    runtime.dispose();
  });
  it('waits for acknowledged setup and the requested native login to finish', async () => {
    const port = agentCatalogPort([], {
      prepareAgent: vi
        .fn()
        .mockResolvedValueOnce({ agents: [{ ...CODEX_AGENT, ready: false, preparing: true }] })
        .mockResolvedValueOnce({ agents: [{ ...CODEX_AGENT, ready: false, preparing: true }] }),
      listAgents: vi
        .fn()
        .mockResolvedValueOnce({ agents: [{ ...CODEX_AGENT, ready: false, needsSignIn: true }] })
        .mockResolvedValueOnce({ agents: [CODEX_AGENT] }),
    });
    await connectAgent(
      port,
      'codex',
      undefined,
      new AbortController().signal,
      async () => undefined,
    );
    expect(vi.mocked(port.prepareAgent).mock.calls.map((call) => call[1])).toEqual([
      'bootstrap',
      'login',
    ]);
  });
});
