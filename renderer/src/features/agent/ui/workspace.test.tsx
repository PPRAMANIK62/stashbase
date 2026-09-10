/** The workspace canvas itself: what it offers with no Agent to talk to, what
 *  the empty canvas keeps quiet, where provider, model and thinking are chosen,
 *  and the first composer turn through its permission decision. */
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type {
  AgentCatalogPort,
  AgentContextPort,
  AgentSessionPort,
} from '@/features/agent/application/ports';
import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';
import type { Agent } from '@/features/agent/domain/agent-catalog';
import { draftOf, expectFocused, typeInto } from '@/test/dom';
import {
  agentCatalogPort,
  agentDefinition,
  agentGateLifted,
  agentSessionPort,
  BUILT_IN_AGENT,
  CLAUDE_AGENT,
  CODEX_AGENT,
  idleAgentSessionPort,
  agentInstructionsApi,
} from '@/test/fakes/agent';
import { createTestQueryClient, withQueryClient } from '@/test/query';

import AgentChats from './chats/chats';
import ManagedAgentWorkspace from './workspace';

const RESEARCH_SCOPE = { kind: 'folder', path: '/Library/Research' } as const;

const runtimes: AgentWorkspaceRuntime[] = [];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

function renderWorkspace(
  session: AgentSessionPort,
  agents: readonly Agent[] = [BUILT_IN_AGENT, CODEX_AGENT, CLAUDE_AGENT],
  context?: AgentContextPort,
  onReprocess?: (source: { folderPath: string; path: string }) => void,
  catalogOverrides: Partial<AgentCatalogPort> = {},
) {
  let id = 0;
  const runtime = createAgentWorkspaceRuntime({
    autostart: false,
    context,
    createId: () => `chat-${++id}`,
    folderPath: RESEARCH_SCOPE.path,
    port: session,
  });
  runtimes.push(runtime);
  const catalog = agentCatalogPort(agents, catalogOverrides);
  const view = withQueryClient(
    <div>
      <AgentChats
        catalog={catalog}
        onOpenAgentSettings={vi.fn()}
        runtime={runtime}
        scope={RESEARCH_SCOPE}
        workspaceName="Research"
      />
      <ManagedAgentWorkspace
        catalog={catalog}
        instructions={agentInstructionsApi()}
        onOpenAgentSettings={vi.fn()}
        onOpenExternal={vi.fn()}
        onReprocess={onReprocess}
        runtime={runtime}
        scopeOutline={{ files: ['MISSION.md', 'notes.md'], folders: ['lessons'] }}
      />
    </div>,
    createTestQueryClient(),
    { strict: true },
  );
  return { runtime, view };
}

describe('Agent workspace', () => {
  it('keeps the composer and its draft while Agent setup stands', async () => {
    const notReady = agentDefinition({ ready: false });
    const { runtime } = renderWorkspace(idleAgentSessionPort(), [notReady]);
    await agentGateLifted();

    expect(await screen.findByText('No Agent is ready yet.')).not.toBeNull();
    const composer = screen.getByRole('textbox', { name: 'Message' });
    typeInto(composer, 'Build wiki pages for this folder');
    expect(draftOf(runtime)).toBe('Build wiki pages for this folder');
    // The request is written, and stays written: a gate that took the canvas
    // away to ask for setup would take the request with it.
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Set up Wiki Agent' })).not.toBeNull();
    // Nothing the runtime cannot do is advertised while it cannot carry a turn.
    expect(screen.queryByRole('button', { name: 'Attach files' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Provider: / })).toBeNull();
  });

  it('names sign-in rather than installation for a runtime that only needs it', async () => {
    renderWorkspace(idleAgentSessionPort(), [
      agentDefinition({ needsSignIn: true, ready: false }),
    ]);
    await agentGateLifted();

    expect(await screen.findByRole('button', { name: 'Sign in to Wiki Agent' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Set up Wiki Agent' })).toBeNull();
  });

  it('holds the setup offer back until the catalog has answered', async () => {
    let answer!: (catalog: { agents: Agent[] }) => void;
    const answered = new Promise<{ agents: Agent[] }>((resolve) => {
      answer = resolve;
    });
    renderWorkspace(idleAgentSessionPort(), [], undefined, undefined, {
      listAgents: vi.fn(() => answered),
    });

    expect(await screen.findByText('Checking runtimes…')).not.toBeNull();
    // An unanswered catalog is not the same as nothing being ready: offering
    // setup here shows it for a moment and then withdraws it.
    expect(screen.queryByText('No Agent is ready yet.')).toBeNull();
    await act(async () => {
      answer({ agents: [BUILT_IN_AGENT] });
      await answered;
    });
    await agentGateLifted();
    expect(screen.queryByText('No Agent is ready yet.')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Provider: Wiki Agent' })).not.toBeNull();
  });

  it('carries a waiting request into the runtime the reader sets up', async () => {
    const notReady = agentDefinition({ ready: false });
    const { runtime } = renderWorkspace(idleAgentSessionPort(), [notReady], undefined, undefined, {
      prepareAgent: vi.fn(async () => ({ agents: [CODEX_AGENT] })),
    });
    await agentGateLifted();

    typeInto(
      await screen.findByRole('textbox', { name: 'Message' }),
      'Build wiki pages for this folder',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Set up Wiki Agent' }));

    // The runtime that arrived is not the one this chat opened on, so the chat
    // follows it — and finds the same request waiting.
    expect(await screen.findByRole('button', { name: 'Provider: Codex' })).not.toBeNull();
    expect(runtime.activeSession().store.getState().agent).toBe('codex');
    expect(draftOf(runtime)).toBe('Build wiki pages for this folder');
    expect(screen.queryByText('No Agent is ready yet.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
  });

  it('offers building a wiki as a prefilled request rather than a control', async () => {
    const port = idleAgentSessionPort();
    const { runtime } = renderWorkspace(port);
    await screen.findByText('Your Wiki is here.');
    await agentGateLifted();

    // The starter row is the only place a folder window says the folder can
    // gain a wiki at all, so this row is J12's entrance.
    await userEvent.click(screen.getByRole('button', { name: 'Build my wiki' }));

    expect(draftOf(runtime)).toBe(
      "Build a wiki for Research: create or improve the pages that map what's here.",
    );
    // Prefilled, not sent: the visible request stays the reader's to edit, so
    // what the Agent receives is still exactly what the transcript records.
    expect(port.connect).not.toHaveBeenCalled();
    expectFocused(screen.getByRole('textbox', { name: 'Message' }));
  });

  it('keeps the empty canvas quiet and puts provider choice in the composer', async () => {
    const port = idleAgentSessionPort();
    const { runtime } = renderWorkspace(port);

    expect(port.connect).not.toHaveBeenCalled();
    expect(await screen.findByText('Your Wiki is here.')).not.toBeNull();
    await agentGateLifted();
    expect(screen.queryByText('Research workspace')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Summarize lessons/' }));
    expect(runtime.activeSession().store.getState().draft).toBe(
      "Summarize what's in lessons/ and what each file covers.",
    );
    const composer = screen.getByRole('textbox', { name: 'Message' });
    expectFocused(composer);
    expect(port.connect).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Chat scope: Research')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close conversation' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Provider: Wiki Agent' })).toHaveLength(1);

    const newChat = screen.getByRole('button', { name: 'Start new chat' });
    await userEvent.click(newChat);
    expect(port.connect).not.toHaveBeenCalled();
    expect(runtime.activeSession().store.getState().agent).toBe('stashbase');

    await userEvent.click(screen.getByRole('button', { name: 'Provider: Wiki Agent' }));
    const codexOption = await screen.findByRole('menuitemradio', { name: 'Codex' });
    const claudeOption = screen.getByRole('menuitemradio', { name: 'Claude Code' });
    // The provider marks are aria-hidden, injected third-party SVG markup (`@lobehub/icons-static-svg`);
    // their internal shape is the contract here.
    const codexMark = codexOption.querySelector('svg[viewBox="-2 -2 28 28"]'); // dom-contract: see comment above
    const claudeMark = claudeOption.querySelector('svg[viewBox="-2 -2 28 28"]'); // dom-contract: see comment above
    expect(codexMark?.querySelector('linearGradient')).not.toBeNull(); // dom-contract: see comment above
    expect(claudeMark?.querySelector('path[fill="#D97757"]')).not.toBeNull(); // dom-contract: see comment above
    expect(codexOption.querySelector('svg title')).toBeNull(); // dom-contract: see comment above
    expect(claudeOption.querySelector('svg title')).toBeNull(); // dom-contract: see comment above
    await userEvent.click(codexOption);
    expect(screen.getByRole('button', { name: 'Provider: Codex' })).not.toBeNull();
    expect(runtime.activeSession().store.getState().agent).toBe('codex');
    expect(port.connect).not.toHaveBeenCalled();
  });

  it('uses runtime-native model and thinking choices from the composer', async () => {
    const { listeners, port, sent } = agentSessionPort();
    const requests = () => vi.mocked(port.connect).mock.calls.map(([request]) => request);
    renderWorkspace(port);

    await userEvent.click(await screen.findByRole('button', { name: 'Provider: Wiki Agent' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Codex' }));
    await userEvent.click(screen.getByRole('button', { name: 'Model: Default' }));
    expect(requests()).toHaveLength(1);

    act(() => {
      listeners[0]?.onEvent({
        activeModel: null,
        fallback: null,
        kind: 'models',
        models: [
          {
            id: 'gpt-codex',
            label: 'Opus (1M context) with extended reasoning',
            supportedEfforts: ['low', 'high'],
          },
        ],
      });
      listeners[0]?.onEvent({ kind: 'ready' });
    });
    const longModelOption = await screen.findByRole('menuitemradio', {
      name: 'Opus (1M context) with extended reasoning',
    });
    await userEvent.click(longModelOption);
    expect(sent).toContainEqual({ kind: 'select-model', model: 'gpt-codex' });
    expect(
      screen.getByRole('button', {
        name: 'Model: Opus (1M context) with extended reasoning',
      }),
    ).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Thinking: Default' }));
    const highEffortOption = await screen.findByRole('menuitemradio', {
      name: 'High. Deeper reasoning',
    });
    await userEvent.click(highEffortOption);
    expect(requests().at(-1)).toMatchObject({ effort: 'high', model: 'gpt-codex' });
    expect(screen.getByRole('button', { name: 'Thinking: High' })).not.toBeNull();
  });

  it('starts the first composer turn and presents an explicit permission decision', async () => {
    const { listeners, port, sent } = agentSessionPort();
    const { runtime } = renderWorkspace(port);
    await screen.findByText('Your Wiki is here.');
    await agentGateLifted();
    await userEvent.click(screen.getByRole('button', { name: 'Provider: Wiki Agent' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Codex' }));

    const composer = screen.getByRole('textbox', { name: 'Message' });
    typeInto(composer, 'Inspect the workspace');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(draftOf(runtime)).toBe('Inspect the workspace');

    act(() => listeners[0]?.onEvent({ kind: 'ready' }));
    expect(await screen.findByText('Inspect the workspace')).not.toBeNull();
    expect(sent).toEqual([{ kind: 'prompt', skill: null, text: 'Inspect the workspace' }]);

    act(() => {
      listeners[0]?.onEvent({ kind: 'turn-started' });
      listeners[0]?.onEvent({
        id: 'permission-1',
        input: { command: 'pnpm test:agent' },
        kind: 'permission-requested',
        name: 'Bash',
        title: null,
        toolUseId: 'tool-1',
      });
    });
    expect(screen.getByRole('heading', { name: 'Run this command?' })).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(sent.at(-1)).toEqual({
      allow: true,
      always: null,
      id: 'permission-1',
      kind: 'reply-permission',
    });

    await userEvent.click(screen.getByRole('button', { name: /Permission mode: Auto/u }));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {
        name: 'Ask. Ask before actions',
      }),
    );
    expect(sent.at(-1)).toEqual({ kind: 'set-access-mode', mode: 'default' });
  });
});
