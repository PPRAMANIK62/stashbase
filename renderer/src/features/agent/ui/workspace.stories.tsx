import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { createAgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import { cn } from '@/lib/utils';
import type { Agent } from '@/shared/agent-runtime';

import { AgentTitlebar } from './titlebar';
import ManagedAgentWorkspace from './workspace';

const capabilities: NonNullable<Agent['capabilities']> = {
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
};

const agents: Agent[] = [
  {
    bootstrap: { phase: 'ready' },
    capabilities,
    id: 'codex',
    installHint: '',
    installed: true,
    label: 'Codex',
    launchCommand: 'codex',
    source: 'system',
    state: 'available',
    vendor: 'OpenAI',
  },
  {
    bootstrap: { phase: 'ready' },
    capabilities,
    id: 'claude',
    installHint: '',
    installed: true,
    label: 'Claude Code',
    launchCommand: 'claude',
    source: 'system',
    state: 'available',
    vendor: 'Anthropic',
  },
  {
    bootstrap: { phase: 'ready' },
    capabilities,
    id: 'stashbase',
    installHint: '',
    installed: true,
    label: 'Built-in',
    launchCommand: '',
    source: 'system',
    state: 'available',
    vendor: 'StashBase',
  },
];

function WorkspacePreview({
  docked = false,
  empty = false,
}: {
  docked?: boolean;
  empty?: boolean;
}) {
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [],
  );
  const runtime = useMemo(() => {
    const next = createAgentWorkspaceRuntime({
      autostart: false,
      createId: () => 'preview-chat',
      folderPath: '/Library/Research',
      port: {
        connect: (_request, listener) => {
          queueMicrotask(() => listener.onEvent({ kind: 'ready' }));
          return { close: () => undefined, send: () => true };
        },
        list: async () => [],
        remove: async () => undefined,
        rename: async (entry) => entry,
        replay: async () => ({ effort: null, transcript: [] }),
      },
    });
    next.newChat('codex', { kind: 'folder', path: '/Library/Research' });
    next.activeSession().store.setState({
      accessMode: 'plan',
      activeModel: 'gpt-5.3-codex',
      effort: 'high',
      model: 'gpt-5.3-codex',
      models: [
        {
          id: 'gpt-5.3-codex',
          label: 'GPT-5.3 Codex',
          supportedEfforts: ['low', 'medium', 'high', 'xhigh'],
        },
        {
          id: 'gpt-5.2-codex',
          label: 'GPT-5.2 Codex (recommended for agentic coding)',
          supportedEfforts: ['low', 'medium', 'high'],
        },
      ],
      phase: empty ? 'draft' : 'live',
      title: empty ? 'New chat' : 'Screenshot research',
      transcript: empty
        ? []
        : [
            {
              at: Date.now() - 86_400_000,
              id: 'user-1',
              kind: 'user',
              text: 'Find the best free tools for presenting lesson screenshots.',
            },
            {
              id: 'thinking-1',
              kind: 'thinking',
              text: 'Comparing browser-frame editors and export limits',
            },
            {
              id: 'read-1',
              input: { path: 'research/screenshot-tools.md' },
              kind: 'tool',
              name: 'Read',
              result: 'Loaded the current shortlist.',
              status: 'done',
            },
            {
              id: 'search-1',
              input: { query: 'free screenshot mockup tools' },
              kind: 'tool',
              name: 'Search',
              result: 'Found five relevant tools.',
              status: 'done',
            },
            {
              id: 'reply-1',
              kind: 'assistant',
              text: [
                'Here are the strongest options:',
                '',
                '1. **Screely** — fast browser frames, gradients, and generous PNG exports.',
                '2. **Screenshot.rocks** — simple, local processing with no account.',
                '3. **Pika** — polished templates, with some frames behind a paid plan.',
                '',
                'For a lesson screenshot, start with [Screely](https://www.screely.com).',
              ].join('\n'),
            },
            { at: Date.now(), id: 'user-2', kind: 'user', text: 'Which one exports SVG?' },
            { id: 'reply-2', kind: 'assistant', text: 'Only Screely does, on its free plan.' },
          ],
    });
    return next;
  }, [empty]);

  useEffect(() => () => runtime.dispose(), [runtime]);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className={cn('h-[46rem]', docked ? 'w-[36rem] border-l border-border' : 'w-[64rem]')}
      >
        <div className="flex h-11 items-center border-b border-border px-3">
          <AgentTitlebar runtime={runtime} />
        </div>
        <div className="h-[calc(100%-2.75rem)]">
          <ManagedAgentWorkspace
            catalog={{
              listAgents: async () => ({ clis: agents }),
              prepareAgent: async () => ({ clis: agents }),
            }}
            onOpenExternal={() => undefined}
            onOpenAgentSettings={() => undefined}
            runtime={runtime}
            scopeOutline={{
              files: ['MISSION.md', 'NOTES.md', 'screenshot-tools.md'],
              folders: ['assets', 'lessons', 'reference'],
            }}
          />
        </div>
      </div>
    </QueryClientProvider>
  );
}

const meta = {
  component: WorkspacePreview,
  parameters: {
    controls: { disable: true },
    fluidCanvas: { minHeight: '50rem', width: '68rem' },
  },
  title: 'Agent/Working notebook',
} satisfies Meta<typeof WorkspacePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullWorkspace: Story = {};

export const EmptyWorkspace: Story = {
  args: { empty: true },
};

export const Docked: Story = {
  args: { docked: true },
  parameters: { fluidCanvas: { minHeight: '50rem', width: '40rem' } },
};
