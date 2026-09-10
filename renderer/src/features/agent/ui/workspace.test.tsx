/** The workspace canvas itself: what it offers with no Agent to talk to, what
 *  the empty canvas keeps quiet, where provider, model and thinking are chosen,
 *  and the first composer turn through its permission decision. */
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentContextPort, AgentSessionPort } from '@/features/agent/application/ports';
import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';
import type { Agent } from '@/features/agent/domain/agent-catalog';
import { draftOf, expectFocused, typeInto } from '@/test/dom';
import {
  agentCatalogPort,
  agentSessionPort,
  BUILT_IN_AGENT,
  CLAUDE_AGENT,
  CODEX_AGENT,
  idleAgentSessionPort,
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
  const catalog = agentCatalogPort(agents);
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
  it('offers Agent setup when the workspace has no runtime to talk to', async () => {
    renderWorkspace(idleAgentSessionPort(), []);

    expect(await screen.findByText('Get an Agent ready')).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();
  });

  it('keeps the empty canvas quiet and puts provider choice in the composer', async () => {
    const port = idleAgentSessionPort();
    const { runtime } = renderWorkspace(port);

    expect(port.connect).not.toHaveBeenCalled();
    expect(await screen.findByText('What should we work on?')).not.toBeNull();
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
    await screen.findByText('What should we work on?');
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
