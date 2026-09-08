import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, StrictMode, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentSessionPort } from '@/features/agent/application/ports';
import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';
import type { Agent } from '@/shared/agent-runtime';

import AgentChats from './chats';
import ManagedAgentWorkspace from './workspace';

const builtIn: Agent = {
  bootstrap: { phase: 'ready' },
  id: 'stashbase',
  installHint: '',
  installed: true,
  label: 'Built-in',
  launchCommand: 'opencode',
  source: 'bundled',
  state: 'available',
  vendor: 'StashBase',
};

const codex: Agent = {
  bootstrap: { phase: 'ready' },
  id: 'codex',
  installHint: '',
  installed: true,
  label: 'Codex',
  launchCommand: 'codex',
  source: 'system',
  state: 'available',
  vendor: 'OpenAI',
};

const claude: Agent = {
  bootstrap: { phase: 'ready' },
  id: 'claude',
  installHint: '',
  installed: true,
  label: 'Claude Code',
  launchCommand: 'claude',
  source: 'system',
  state: 'available',
  vendor: 'Anthropic',
};

let getAnimationsDescriptor: PropertyDescriptor | undefined;
const runtimes: AgentWorkspaceRuntime[] = [];

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
});

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});

function renderWorkspace(session: AgentSessionPort, agents: Agent[] = [builtIn, codex, claude]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let id = 0;
  const runtime = createAgentWorkspaceRuntime({
    autostart: false,
    createId: () => `chat-${++id}`,
    folderPath: '/Library/Research',
    port: session,
  });
  runtimes.push(runtime);
  const catalog = {
    listAgents: vi.fn(async () => ({ clis: agents })),
    prepareAgent: vi.fn(),
  };
  const view = render(
    createElement(
      StrictMode,
      null,
      createElement(
        QueryClientProvider,
        { client: queryClient } as PropsWithChildren<{ client: QueryClient }>,
        createElement(
          'div',
          null,
          createElement(AgentChats, {
            catalog,
            onOpenAgentSettings: vi.fn(),
            runtime,
            scope: { kind: 'folder', path: '/Library/Research' },
            workspaceName: 'Research',
          }),
          createElement(ManagedAgentWorkspace, {
            catalog,
            onOpenAgentSettings: vi.fn(),
            runtime,
            withDocuments: false,
          }),
        ),
      ),
    ),
  );
  return { runtime, view };
}

describe('Agent workspace', () => {
  it('centers Agent setup across the full workspace when no document is open', async () => {
    renderWorkspace(
      {
        connect: vi.fn(() => ({ close: vi.fn() })),
        list: vi.fn(async () => []),
        remove: vi.fn(async () => undefined),
        rename: vi.fn(),
        replay: vi.fn(async () => ({ effort: null, transcript: [] })),
      },
      [],
    );

    const setup = await screen.findByText('Get an Agent ready');
    expect(setup.parentElement?.parentElement?.className).toContain('w-full');
  });

  it('keeps New chat quiet and moves Agent choice into the headerless blank canvas', async () => {
    const connect = vi.fn<AgentSessionPort['connect']>(() => ({ close: vi.fn() }));
    const { runtime } = renderWorkspace({
      connect,
      list: vi.fn(async () => []),
      remove: vi.fn(async () => undefined),
      rename: vi.fn(),
      replay: vi.fn(async () => ({ effort: null, transcript: [] })),
    });

    expect(connect).not.toHaveBeenCalled();
    expect(await screen.findByText('Start a conversation')).not.toBeNull();
    expect(screen.getByText('Working in Research')).not.toBeNull();
    expect(screen.queryByLabelText('Chat scope: Research')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close conversation' })).toBeNull();
    expect(screen.queryByLabelText(/Choose Agent for new chat/u)).toBeNull();

    const newChat = screen.getByRole('button', { name: 'Start new chat' });
    expect(newChat.className).toContain('text-muted-foreground');
    expect(newChat.className).toContain('h-9');
    await userEvent.click(newChat);
    expect(connect).not.toHaveBeenCalled();
    expect(runtime.activeSession().store.getState().agent).toBe('stashbase');

    await userEvent.click(screen.getByRole('button', { name: /Choose Agent\. Current Agent/u }));
    const codexOption = await screen.findByRole('menuitemradio', { name: 'Codex' });
    const claudeOption = screen.getByRole('menuitemradio', { name: 'Claude Code' });
    const codexMark = codexOption.querySelector('svg title');
    const claudeMark = claudeOption.querySelector('svg title');
    expect(codexMark?.textContent).toBe('Codex');
    expect(claudeMark?.textContent).toBe('Claude Code');
    expect(codexMark?.parentElement?.parentElement?.className).toContain('translate-y-px');
    expect(claudeMark?.parentElement?.parentElement?.className).toContain('translate-y-px');
    await userEvent.click(codexOption);
    expect(
      screen.getByRole('button', { name: 'Choose Agent. Current Agent: Codex' }),
    ).not.toBeNull();
    expect(runtime.activeSession().store.getState().agent).toBe('codex');
    expect(connect).not.toHaveBeenCalled();
  });

  it('restores a scoped transcript before resuming its native session', async () => {
    const replay = vi.fn<AgentSessionPort['replay']>(async () => ({
      effort: 'high',
      transcript: [{ id: 'reply-1', kind: 'assistant', text: 'Persisted answer' }],
    }));
    const connect = vi.fn<AgentSessionPort['connect']>(() => ({ close: vi.fn() }));
    const list = vi.fn<AgentSessionPort['list']>(async (agent) =>
      agent === 'codex'
        ? [
            {
              agent: 'codex',
              hasContent: true,
              id: 'native-47',
              lastModified: 1_800_000_000_000,
              scope: { kind: 'folder', path: '/Library/Research' },
              title: 'Planning notes',
            },
          ]
        : [],
    );
    renderWorkspace({
      connect,
      list,
      remove: vi.fn(async () => undefined),
      rename: vi.fn(),
      replay,
    });
    await screen.findByText('Start a conversation');

    await userEvent.click(await screen.findByRole('button', { name: 'Planning notes' }));

    expect(await screen.findByText('Persisted answer')).not.toBeNull();
    expect(replay).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'codex',
        id: 'native-47',
        scope: { kind: 'folder', path: '/Library/Research' },
      }),
      expect.any(AbortSignal),
    );
    await waitFor(() =>
      expect(connect).toHaveBeenLastCalledWith(
        expect.objectContaining({
          agent: 'codex',
          resume: 'native-47',
          scope: { kind: 'folder', path: '/Library/Research' },
        }),
        expect.anything(),
      ),
    );
  });

  it('shows only conversations belonging to the selected workspace', async () => {
    renderWorkspace({
      connect: vi.fn(() => ({ close: vi.fn() })),
      list: vi.fn<AgentSessionPort['list']>(async (agent) =>
        agent === 'codex'
          ? [
              {
                agent: 'codex',
                hasContent: true,
                id: 'research-chat',
                lastModified: 20,
                scope: { kind: 'folder', path: '/Library/Research' },
                title: 'Research thread',
              },
              {
                agent: 'codex',
                hasContent: true,
                id: 'plans-chat',
                lastModified: 30,
                scope: { kind: 'folder', path: '/Library/Plans' },
                title: 'Plans thread',
              },
            ]
          : [],
      ),
      remove: vi.fn(async () => undefined),
      rename: vi.fn(),
      replay: vi.fn(async () => ({ effort: null, transcript: [] })),
    });

    expect(await screen.findByRole('button', { name: 'Research thread' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Plans thread' })).toBeNull();
    expect(screen.getByLabelText('Chats in Research')).not.toBeNull();
  });

  it('keeps native history visible when its Agent runtime is unavailable', async () => {
    const unavailableCodex: Agent = {
      ...codex,
      bootstrap: {
        failure: {
          code: 'runtime-unavailable',
          message: 'Codex is unavailable.',
          retryable: true,
          stage: 'discovery',
        },
        phase: 'failed',
      },
      installed: false,
      state: 'unavailable',
    };
    renderWorkspace(
      {
        connect: vi.fn(() => ({ close: vi.fn() })),
        list: vi.fn<AgentSessionPort['list']>(async (agent, scope) =>
          agent === 'codex'
            ? [
                {
                  agent,
                  hasContent: true,
                  id: 'unavailable-runtime-chat',
                  lastModified: Date.now(),
                  scope,
                  title: 'Retained Codex work',
                },
              ]
            : [],
        ),
        remove: vi.fn(async () => undefined),
        rename: vi.fn(),
        replay: vi.fn(async () => ({ effort: null, transcript: [] })),
      },
      [builtIn, unavailableCodex],
    );

    expect(await screen.findByRole('button', { name: 'Retained Codex work' })).not.toBeNull();
  });

  it('renames inline and keeps only Delete in the conversation menu', async () => {
    const entry = {
      agent: 'codex' as const,
      hasContent: true,
      id: 'editable-chat',
      lastModified: Date.now(),
      scope: { kind: 'folder' as const, path: '/Library/Research' },
      title: 'Original title',
    };
    const rename = vi.fn<AgentSessionPort['rename']>(async (_entry, title) => ({
      ...entry,
      title,
    }));
    const remove = vi.fn<AgentSessionPort['remove']>(async () => undefined);
    renderWorkspace({
      connect: vi.fn(() => ({ close: vi.fn() })),
      list: vi.fn<AgentSessionPort['list']>(async (agent) => (agent === 'codex' ? [entry] : [])),
      remove,
      rename,
      replay: vi.fn(async () => ({ effort: null, transcript: [] })),
    });

    const original = await screen.findByRole('button', { name: 'Original title' });
    const visibleTitle = Array.from(original.querySelectorAll('span')).find(
      (span) =>
        span.textContent === 'Original title' &&
        span.children.length === 0 &&
        !span.classList.contains('invisible'),
    );
    expect(visibleTitle).toBeDefined();
    const rowClassName = original.className;
    const ownerDocument = original.ownerDocument;
    const caretPositionDescriptor = Object.getOwnPropertyDescriptor(
      ownerDocument,
      'caretPositionFromPoint',
    );
    Object.defineProperty(ownerDocument, 'caretPositionFromPoint', {
      configurable: true,
      value: vi.fn(() => ({ offset: 5, offsetNode: visibleTitle?.firstChild })),
    });
    let title: HTMLInputElement;
    try {
      await userEvent.dblClick(visibleTitle!);
      title = screen.getByRole('textbox', { name: 'Rename Original title' });
      expect(title.selectionStart).toBe(5);
    } finally {
      if (caretPositionDescriptor) {
        Object.defineProperty(ownerDocument, 'caretPositionFromPoint', caretPositionDescriptor);
      } else {
        Reflect.deleteProperty(ownerDocument, 'caretPositionFromPoint');
      }
    }
    const editor = title.closest('[data-conversation-inline-editor]');
    expect(editor?.className).toBe(rowClassName);
    expect(editor?.className).not.toContain('bg-');
    expect(editor?.className).not.toContain('ring-');
    expect(title.parentElement?.className).not.toContain('bg-');
    expect(title.parentElement?.className).not.toContain('ring-');
    expect(title.className).toContain('rounded-none');
    expect(title.className).toContain('min-w-0');
    expect(title.className).toContain('text-inherit');
    expect(title.className).toContain('[font:inherit]');
    expect(title.className).not.toContain('-mt-');
    expect(title.className).not.toContain('-mb-');
    expect(title.style.fontVariationSettings).not.toBe('');
    await userEvent.clear(title);
    await userEvent.type(title, 'Edited title{Enter}');

    expect(await screen.findByRole('button', { name: 'Edited title' })).not.toBeNull();
    expect(rename).toHaveBeenCalledWith(entry, 'Edited title', expect.any(AbortSignal));

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Edited title' }));
    expect(screen.queryByText('Rename or delete')).toBeNull();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('heading', { name: 'Delete conversation?' })).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  });

  it('shows one collapsible recency tree and omits conversations without content', async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const earlier = new Date(today);
    earlier.setDate(earlier.getDate() - 8);

    renderWorkspace({
      connect: vi.fn(() => ({ close: vi.fn() })),
      list: vi.fn<AgentSessionPort['list']>(async (agent) => {
        if (agent === 'stashbase') {
          return [
            {
              agent: 'stashbase',
              hasContent: false,
              id: 'empty-chat',
              lastModified: today.getTime() + 1_000,
              scope: { kind: 'folder', path: '/Library/Research' },
              title: 'New Chat',
            },
          ];
        }
        if (agent !== 'codex') return [];
        return [
          {
            agent: 'codex',
            hasContent: true,
            id: 'today-newer',
            lastModified: today.getTime(),
            scope: { kind: 'folder', path: '/Library/Research' },
            title: 'Today newer',
          },
          {
            agent: 'codex',
            hasContent: true,
            id: 'today-older',
            lastModified: today.getTime() - 1_000,
            scope: { kind: 'folder', path: '/Library/Research' },
            title: 'Today older',
          },
          {
            agent: 'codex',
            hasContent: true,
            id: 'yesterday-chat',
            lastModified: yesterday.getTime(),
            scope: { kind: 'folder', path: '/Library/Research' },
            title: 'Yesterday chat',
          },
          {
            agent: 'codex',
            hasContent: true,
            id: 'earlier-chat',
            lastModified: earlier.getTime(),
            scope: { kind: 'folder', path: '/Library/Research' },
            title: 'Earlier chat',
          },
        ];
      }),
      remove: vi.fn(async () => undefined),
      rename: vi.fn(),
      replay: vi.fn(async () => ({ effort: null, transcript: [] })),
    });

    await screen.findByRole('button', { name: 'Today newer' });
    expect(screen.queryByText('Open', { exact: true })).toBeNull();
    expect(screen.queryByText('History', { exact: true })).toBeNull();
    expect(screen.queryByRole('button', { name: /^New Chat$/u })).toBeNull();

    const tree = screen.getByLabelText('Conversation tree in Research');
    const groupLabels = Array.from(tree.querySelectorAll('[data-tree-branch]')).map(
      (item) => item.textContent,
    );
    expect(groupLabels).toEqual([
      'Today',
      'Yesterday',
      earlier.toLocaleDateString([], { month: 'long', day: 'numeric' }),
    ]);

    const chatLabels = Array.from(tree.querySelectorAll('[data-conversation]')).map((item) =>
      item.getAttribute('title'),
    );
    expect(chatLabels).toEqual(['Today newer', 'Today older', 'Yesterday chat', 'Earlier chat']);

    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.queryByRole('button', { name: 'Today newer' })).toBeNull();
  });
});
