import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, StrictMode, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentConnectionListener, AgentSessionPort } from '@/features/agent/application/ports';
import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';
import type { Agent } from '@/shared/agent-runtime';

import AgentChats from './chats/chats';
import ManagedAgentWorkspace from './workspace';

const nativeCapabilities = {
  approvals: true,
  attachments: true,
  connection: true,
  effort: true,
  history: true,
  interrupt: true,
  models: true,
  modes: true,
  prompts: true,
  skills: true,
  steering: true,
  titleHint: true,
  transcript: true,
} as const;

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
  capabilities: nativeCapabilities,
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
  capabilities: { ...nativeCapabilities, steering: false, titleHint: false },
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
            onOpenExternal: vi.fn(),
            onOpenAgentSettings: vi.fn(),
            runtime,
            scopeOutline: { files: ['MISSION.md', 'notes.md'], folders: ['lessons'] },
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

  it('keeps the empty canvas quiet and puts provider choice in the composer', async () => {
    const connect = vi.fn<AgentSessionPort['connect']>(() => ({ close: vi.fn() }));
    const { runtime } = renderWorkspace({
      connect,
      list: vi.fn(async () => []),
      remove: vi.fn(async () => undefined),
      rename: vi.fn(),
      replay: vi.fn(async () => ({ effort: null, transcript: [] })),
    });

    expect(connect).not.toHaveBeenCalled();
    expect(await screen.findByText('What should we work on?')).not.toBeNull();
    expect(screen.queryByText('Research workspace')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Summarize lessons/' }));
    expect(runtime.activeSession().store.getState().draft).toBe(
      "Summarize what's in lessons/ and what each file covers.",
    );
    const composer = screen.getByPlaceholderText('Ask about Research…');
    expect(composer.ownerDocument.activeElement).toBe(composer);
    expect(connect).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Chat scope: Research')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close conversation' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Provider: Built-in' })).toHaveLength(1);

    const newChat = screen.getByRole('button', { name: 'Start new chat' });
    expect(newChat.className).toContain('text-muted-foreground');
    expect(newChat.className).toContain('h-9');
    await userEvent.click(newChat);
    expect(connect).not.toHaveBeenCalled();
    expect(runtime.activeSession().store.getState().agent).toBe('stashbase');

    await userEvent.click(screen.getByRole('button', { name: 'Provider: Built-in' }));
    const codexOption = await screen.findByRole('menuitemradio', { name: 'Codex' });
    const claudeOption = screen.getByRole('menuitemradio', { name: 'Claude Code' });
    const codexMark = codexOption.querySelector('svg[viewBox="-2 -2 28 28"]');
    const claudeMark = claudeOption.querySelector('svg[viewBox="-2 -2 28 28"]');
    expect(codexMark?.querySelector('linearGradient')).not.toBeNull();
    expect(claudeMark?.querySelector('path[fill="#D97757"]')).not.toBeNull();
    expect(codexOption.querySelector('svg title')).toBeNull();
    expect(claudeOption.querySelector('svg title')).toBeNull();
    await userEvent.click(codexOption);
    expect(screen.getByRole('button', { name: 'Provider: Codex' })).not.toBeNull();
    expect(runtime.activeSession().store.getState().agent).toBe('codex');
    expect(connect).not.toHaveBeenCalled();
  });

  it('uses runtime-native model and thinking choices from the composer', async () => {
    const listeners: AgentConnectionListener[] = [];
    const requests: Parameters<AgentSessionPort['connect']>[0][] = [];
    const sent: unknown[] = [];
    renderWorkspace({
      connect: vi.fn((request, listener) => {
        requests.push(request);
        listeners.push(listener);
        return {
          close: vi.fn(),
          send: vi.fn((event) => {
            sent.push(event);
            return true;
          }),
        };
      }),
      list: vi.fn(async () => []),
      remove: vi.fn(async () => undefined),
      rename: vi.fn(),
      replay: vi.fn(async () => ({ effort: null, transcript: [] })),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Provider: Built-in' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Codex' }));
    await userEvent.click(screen.getByRole('button', { name: 'Model: Default' }));
    expect(requests).toHaveLength(1);

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
    expect(longModelOption.querySelector('[data-menu-item-label]')?.className).toContain(
      'whitespace-normal',
    );
    expect(longModelOption.className).toContain('items-center');
    expect(longModelOption.className).not.toContain('items-start');
    expect(longModelOption.querySelector('[data-menu-item-content]')?.className).toContain(
      'translate-y-px',
    );
    await userEvent.click(longModelOption);
    expect(sent).toContainEqual({ model: 'gpt-codex', t: 'set-model' });
    expect(
      screen.getByRole('button', {
        name: 'Model: Opus (1M context) with extended reasoning',
      }),
    ).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Thinking: Default' }));
    const highEffortOption = await screen.findByRole('menuitemradio', {
      name: 'High. Deeper reasoning',
    });
    expect(highEffortOption.firstElementChild?.className).toContain('items-center');
    expect(highEffortOption.firstElementChild?.className).not.toContain('items-baseline');
    expect(highEffortOption.firstElementChild?.className).toContain('translate-y-px');
    await userEvent.click(highEffortOption);
    expect(requests.at(-1)).toMatchObject({ effort: 'high', model: 'gpt-codex' });
    expect(screen.getByRole('button', { name: 'Thinking: High' })).not.toBeNull();
  });

  it('starts the first composer turn and presents an explicit permission decision', async () => {
    let listener: AgentConnectionListener | undefined;
    const sent: unknown[] = [];
    renderWorkspace({
      connect: vi.fn((_request, nextListener) => {
        listener = nextListener;
        return {
          close: vi.fn(),
          send: vi.fn((event) => {
            sent.push(event);
            return true;
          }),
        };
      }),
      list: vi.fn(async () => []),
      remove: vi.fn(async () => undefined),
      rename: vi.fn(),
      replay: vi.fn(async () => ({ effort: null, transcript: [] })),
    });
    await screen.findByText('What should we work on?');
    await userEvent.click(screen.getByRole('button', { name: 'Provider: Built-in' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Codex' }));

    const composer = screen.getByRole('textbox', { name: 'Message' });
    await userEvent.type(composer, 'Inspect the workspace');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect((composer as HTMLTextAreaElement).value).toBe('Inspect the workspace');

    act(() => listener?.onEvent({ kind: 'ready' }));
    expect(await screen.findByText('Inspect the workspace')).not.toBeNull();
    expect(sent).toEqual([{ t: 'prompt', text: 'Inspect the workspace' }]);

    act(() => {
      listener?.onEvent({ kind: 'turn-started' });
      listener?.onEvent({
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
      always: undefined,
      id: 'permission-1',
      t: 'permission-reply',
    });

    await userEvent.click(screen.getByRole('button', { name: /Permission mode: Auto/u }));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {
        name: 'Ask. Ask before actions',
      }),
    );
    expect(sent.at(-1)).toEqual({ mode: 'default', t: 'set-mode' });
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
    await screen.findByText('What should we work on?');

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
