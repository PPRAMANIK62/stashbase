/** The workspace canvas itself: what it offers with no Agent to talk to, what
 *  the empty canvas keeps quiet, where provider, model and thinking are chosen,
 *  the first composer turn through its permission decision, and the header
 *  that names the Chat and renames it in place. */
import { act, cleanup, screen, waitFor } from '@testing-library/react';
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
import { draftOf, expectFocused, pressKey, typeInto } from '@/test/dom';
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
        onSignIn={vi.fn()}
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
    expect(screen.getByRole('button', { name: 'Sign in to OpenQuill' })).not.toBeNull();
    // Nothing the runtime cannot do is advertised while it cannot carry a turn.
    expect(screen.queryByRole('button', { name: 'Attach files' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Provider: / })).toBeNull();
  });

  it('names sign-in rather than installation for a runtime that only needs it', async () => {
    renderWorkspace(idleAgentSessionPort(), [
      agentDefinition({ id: 'codex', label: 'Codex', needsSignIn: true, ready: false }),
    ]);
    await agentGateLifted();

    expect(await screen.findByRole('button', { name: 'Sign in to Codex' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Set up Codex' })).toBeNull();
  });

  it('offers the bundled runtime sign-in before any attempt has named the account', async () => {
    // The catalog only reports `needsSignIn` once a bootstrap has come back
    // authentication-required. The bundled runtime has no setup step to offer
    // in the meantime, so the offer must not invent one.
    renderWorkspace(idleAgentSessionPort(), [
      agentDefinition({ needsSignIn: false, ready: false }),
    ]);
    await agentGateLifted();

    expect(await screen.findByRole('button', { name: 'Sign in to OpenQuill' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Set up OpenQuill' })).toBeNull();
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
    expect(await screen.findByRole('button', { name: 'Provider: OpenQuill' })).not.toBeNull();
  });

  it('carries a waiting request into the runtime the reader sets up', async () => {
    const notReady = agentDefinition({ id: 'claude', label: 'Claude Code', ready: false });
    const { runtime } = renderWorkspace(idleAgentSessionPort(), [notReady], undefined, undefined, {
      prepareAgent: vi.fn(async () => ({ agents: [CODEX_AGENT] })),
    });
    await agentGateLifted();

    typeInto(
      await screen.findByRole('textbox', { name: 'Message' }),
      'Build wiki pages for this folder',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Set up Claude Code' }));

    // The runtime that arrived is not the one this chat opened on, so the chat
    // follows it — and finds the same request waiting.
    expect(await screen.findByRole('button', { name: 'Provider: Codex' })).not.toBeNull();
    expect(runtime.activeSession().store.getState().agent).toBe('codex');
    expect(draftOf(runtime)).toBe('Build wiki pages for this folder');
    expect(screen.queryByText('No Agent is ready yet.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
  });

  it('cycles the blank composer through the three requests, and Tab takes the one showing', async () => {
    const port = idleAgentSessionPort();
    const { runtime } = renderWorkspace(port);
    await screen.findByText('From wiki to words.');
    await agentGateLifted();

    // The placeholder is the only place a folder window says the folder can
    // gain a wiki at all, so it is J12's entrance. It opens on the wiki.
    expect(screen.getByText('Build a wiki for Research')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Build/u })).toBeNull();

    const field = screen.getByRole('textbox', { name: 'Message' });
    await userEvent.click(field);
    await userEvent.keyboard('{Tab}');

    expect(draftOf(runtime)).toBe('Build a wiki for Research');
    // Filled, not sent: the visible request stays the reader's to edit, so
    // what the Agent receives is still exactly what the transcript records.
    expect(port.connect).not.toHaveBeenCalled();
    expectFocused(field);
  });

  it('keeps the empty canvas quiet and puts provider choice in the composer', async () => {
    const port = idleAgentSessionPort();
    const { runtime } = renderWorkspace(port);

    expect(port.connect).not.toHaveBeenCalled();
    expect(await screen.findByText('From wiki to words.')).not.toBeNull();
    await agentGateLifted();
    expect(screen.queryByText('Research workspace')).toBeNull();
    const composer = screen.getByRole('textbox', { name: 'Message' });
    await userEvent.type(composer, 'Summarize lessons/');
    expect(runtime.activeSession().store.getState().draft).toBe('Summarize lessons/');
    expectFocused(composer);
    expect(port.connect).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Chat scope: Research')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close conversation' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Provider: OpenQuill' })).toHaveLength(1);

    const newChat = screen.getByRole('button', { name: 'Start new chat' });
    await userEvent.click(newChat);
    expect(port.connect).not.toHaveBeenCalled();
    expect(runtime.activeSession().store.getState().agent).toBe('stashbase');

    await userEvent.click(screen.getByRole('button', { name: 'Provider: OpenQuill' }));
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

    await userEvent.click(await screen.findByRole('button', { name: 'Provider: OpenQuill' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Codex' }));
    await userEvent.click(screen.getByRole('button', { name: 'Model and thinking: Default' }));
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
    // The menu opened on the level; the model list is one layer deeper, and
    // this runtime has named no default, so nothing is marked there yet.
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Model. Default' }));
    const longModelOption = await screen.findByRole('menuitemradio', {
      name: 'Opus (1M context) with extended reasoning',
    });
    await userEvent.click(longModelOption);
    expect(sent).toContainEqual({ kind: 'select-model', model: 'gpt-codex' });
    expect(
      screen.getByRole('button', {
        name: 'Model and thinking: Opus (1M context) with extended reasoning',
      }),
    ).not.toBeNull();

    // The pick closes the menu, which leaves once its exit has played; the
    // level is chosen from the same control, reopened on its first layer.
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull(), { timeout: 2000 });
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Model and thinking: Opus (1M context) with extended reasoning',
      }),
    );
    const highEffortOption = await screen.findByRole('menuitemradio', {
      name: 'High. Deeper reasoning',
    });
    await userEvent.click(highEffortOption);
    expect(requests().at(-1)).toMatchObject({ effort: 'high', model: 'gpt-codex' });
    expect(
      screen.getByRole('button', {
        name: 'Model and thinking: Opus (1M context) with extended reasoning, High',
      }),
    ).not.toBeNull();
  });

  it('starts the first composer turn and presents an explicit permission decision', async () => {
    const { listeners, port, sent } = agentSessionPort();
    const { runtime } = renderWorkspace(port);
    await screen.findByText('From wiki to words.');
    await agentGateLifted();
    await userEvent.click(screen.getByRole('button', { name: 'Provider: OpenQuill' }));
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
        name: 'Ask. Asks before every change and command',
      }),
    );
    expect(sent.at(-1)).toEqual({ kind: 'set-access-mode', mode: 'default' });
  });

  it('names the remembered default model and level before any session exists', async () => {
    const codex = agentDefinition({
      ...CODEX_AGENT,
      models: [
        {
          defaultEffort: 'medium',
          id: 'gpt-6-astra',
          isDefault: true,
          label: 'GPT-6-Astra',
          supportedEfforts: ['low', 'medium', 'high'],
        },
        { id: 'gpt-5.5', label: 'GPT-5.5' },
      ],
    });
    const { port } = agentSessionPort();
    renderWorkspace(port, [codex]);
    await agentGateLifted();

    expect(
      await screen.findByRole('button', { name: 'Model and thinking: GPT-6-Astra, Medium' }),
    ).not.toBeNull();
    // Named from the runtime's remembered catalog: no session was started.
    expect(port.connect).not.toHaveBeenCalled();
  });

  it('offers only the modes the runtime honors and settles a session off one it cannot', async () => {
    const readOnlyRuntime = agentDefinition({
      abilities: { ...BUILT_IN_AGENT.abilities, modes: ['default', 'plan'] },
    });
    const { runtime } = renderWorkspace(idleAgentSessionPort(), [readOnlyRuntime]);
    await agentGateLifted();

    // New sessions start in Auto; this runtime cannot keep that promise, so
    // the session moves to Ask before any turn binds it.
    await waitFor(() =>
      expect(runtime.activeSession().store.getState().accessMode).toBe('default'),
    );
    await userEvent.click(screen.getByRole('button', { name: /^Permission mode: Ask\./u }));
    expect(
      (await screen.findAllByRole('menuitemradio')).map((row) => row.getAttribute('aria-label')),
    ).toEqual([
      'Ask. Asks before every change and command',
      'Plan. Reads and explores, changes nothing',
    ]);
  });

  it('takes the latest prompt back into the composer from its edit control', async () => {
    const { listeners, port } = agentSessionPort();
    const { runtime } = renderWorkspace(port);
    await screen.findByText('From wiki to words.');
    await agentGateLifted();
    await userEvent.click(screen.getByRole('button', { name: 'Provider: OpenQuill' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Codex' }));

    typeInto(screen.getByRole('textbox', { name: 'Message' }), 'Inspect the workspace');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    act(() => listeners[0]?.onEvent({ kind: 'ready' }));
    await screen.findByText('Inspect the workspace');
    act(() => {
      listeners[0]?.onEvent({ kind: 'turn-started' });
      listeners[0]?.onEvent({ delta: 'A small workspace.', kind: 'text' });
    });
    // Streaming: copy is there, edit is not.
    expect(screen.getByRole('button', { name: 'Copy message' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();

    act(() => listeners[0]?.onEvent({ isError: false, kind: 'turn-ended' }));
    expect(draftOf(runtime)).toBe('');
    await userEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    expect(draftOf(runtime)).toBe('Inspect the workspace');
    await waitFor(() => expectFocused(screen.getByRole('textbox', { name: 'Message' })));
    // The sent prompt stays in the transcript; the edit is the next turn.
    expect(screen.getAllByText('Inspect the workspace').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Chat header', () => {
  it('names the blank Chat as plain text and lets it be renamed once a turn exists', async () => {
    const { listeners, port } = agentSessionPort();
    const { runtime } = renderWorkspace(port);
    await agentGateLifted();

    // The header labels itself "<title>, <runtime>"; the new-chat button's
    // label has no comma, so the pattern reaches only the header. Before
    // anything is said there is nothing to rename, so the name is not a
    // control.
    expect(await screen.findByRole('heading', { name: /^Untitled, / })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^Untitled, / })).toBeNull();

    typeInto(screen.getByRole('textbox', { name: 'Message' }), 'Inspect the workspace');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    act(() => listeners[0]?.onEvent({ kind: 'ready' }));
    await screen.findByText('Inspect the workspace');

    const header = await screen.findByRole('button', { name: /^Untitled, / });
    expect(screen.queryByRole('heading', { name: /^Untitled, / })).toBeNull();
    pressKey(header, 'F2');
    const field = screen.getByRole('textbox', { name: 'Rename Untitled' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Reading list{Enter}');

    expect(await screen.findByRole('button', { name: /^Reading list, / })).not.toBeNull();
    expect(runtime.activeSession().store.getState().title).toBe('Reading list');
  });

  it('keeps a header rename on record once the runtime has identified the chat', async () => {
    const entry = {
      agent: 'codex' as const,
      hasContent: true,
      id: 'identified-chat',
      lastModified: Date.now(),
      scope: RESEARCH_SCOPE,
      title: 'Original title',
    };
    const rename = vi.fn<AgentSessionPort['rename']>(async (_entry, title) => ({
      ...entry,
      title,
    }));
    renderWorkspace(
      idleAgentSessionPort({
        list: vi.fn<AgentSessionPort['list']>(async (agent) => (agent === 'codex' ? [entry] : [])),
        rename,
      }),
    );
    await agentGateLifted();

    // Opening the row restores the conversation, which is what binds the
    // pane's session to the record the header will rename.
    await userEvent.click(await screen.findByRole('button', { name: 'Original title' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Original title, Codex' }));
    const field = screen.getByRole('textbox', { name: 'Rename Original title' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Edited title{Enter}');

    expect(await screen.findByRole('button', { name: 'Edited title, Codex' })).not.toBeNull();
    expect(rename).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'codex', id: 'identified-chat', scope: RESEARCH_SCOPE }),
      'Edited title',
      expect.any(AbortSignal),
    );
    // The Chats panel reads the same name without a refetch.
    expect(screen.getByRole('button', { name: 'Edited title' })).not.toBeNull();
  });

  it('hands the old name back and says why when the record refuses the rename', async () => {
    const entry = {
      agent: 'codex' as const,
      hasContent: true,
      id: 'refusing-chat',
      lastModified: Date.now(),
      scope: RESEARCH_SCOPE,
      title: 'Original title',
    };
    renderWorkspace(
      idleAgentSessionPort({
        list: vi.fn<AgentSessionPort['list']>(async (agent) => (agent === 'codex' ? [entry] : [])),
        rename: vi.fn<AgentSessionPort['rename']>(async () => {
          throw new Error('offline');
        }),
      }),
    );
    await agentGateLifted();

    await userEvent.click(await screen.findByRole('button', { name: 'Original title' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Original title, Codex' }));
    const field = screen.getByRole('textbox', { name: 'Rename Original title' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Edited title{Enter}');

    expect(await screen.findByRole('alert')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Original title, Codex' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Edited title, Codex' })).toBeNull();
  });
});
