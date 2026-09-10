import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { expect, screen, waitFor } from 'storybook/test';

import type { AgentInstructionsPort } from '@/features/agent/application/ports';
import { createAgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import type { Agent } from '@/features/agent/domain/agent-catalog';
import { cn } from '@/lib/utils';

import { AgentTitlebar } from './titlebar';
import ManagedAgentWorkspace from './workspace';

const storyInstructions = {
  load: async () => ({ customized: false, text: 'Keep answers grounded in this folder.' }),
  save: async (_scope: unknown, text: string) => ({ customized: text !== '', text }),
} as AgentInstructionsPort;

const abilities: Agent['abilities'] = {
  attachments: true,
  effort: true,
  models: true,
  modes: true,
  skills: true,
};

const agents: Agent[] = [
  { abilities, id: 'codex', label: 'Codex', needsSignIn: false, ready: true },
  { abilities, id: 'claude', label: 'Claude Code', needsSignIn: false, ready: true },
  { abilities, id: 'stashbase', label: 'Wiki Agent', needsSignIn: false, ready: true },
];

/** The same runtimes before any of them can carry a turn: one waiting on
 *  sign-in, the rest on installation. */
const pendingAgents: Agent[] = agents.map((agent) => ({
  ...agent,
  needsSignIn: agent.id === 'codex',
  ready: false,
}));

const STORY_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#6B97FF"/><path d="M24 124 65 74l26 31 19-18 26 37Z" fill="#fff"/></svg>';

const SKILLS = [
  { id: 'review', label: 'review', description: 'Review a draft', argumentHint: 'what to review' },
  { id: 'summarize', label: 'summarize', description: 'Summarize a folder' },
];

/** The catalog answers asynchronously, so a story that means to show a working
 *  conversation has to wait for the setup gate to lift. Without it the canvas
 *  is scored mid-check, and the composer's controls are never looked at. */
const readyWorkspace = async () => {
  await waitFor(() => expect(screen.queryByText('Checking runtimes…')).toBeNull());
  await screen.findByRole('button', { name: /^Provider: / });
};

function WorkspacePreview({
  context = false,
  docked = false,
  empty = false,
  ready = true,
  skills = false,
}: {
  context?: boolean;
  docked?: boolean;
  empty?: boolean;
  /** False draws the window a reader meets before any runtime is set up. */
  ready?: boolean;
  skills?: boolean;
}) {
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [],
  );
  const runtime = useMemo(() => {
    const next = createAgentWorkspaceRuntime({
      autostart: false,
      context: {
        resolve: async (source) => ({
          available: true,
          folder: 'Research',
          kind: 'direct',
          path: `${source.folderPath}/${source.path}`,
          readPath: source.path,
          reason: '',
          sourceFormat: 'md',
          sourcePath: source.path,
        }),
        upload: async (files) =>
          files.map((file) => ({ name: file.name, path: `/tmp/attach/${file.name}` })),
      },
      createId: () => 'preview-chat',
      folderPath: '/Library/Research',
      port: {
        connect: (_request, listener) => {
          queueMicrotask(() => {
            listener.onEvent({ error: null, kind: 'skills', skills: SKILLS, state: 'available' });
            listener.onEvent({ kind: 'ready' });
          });
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
      connection: empty ? { kind: 'draft' } : { kind: 'live', turn: null },
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
    if (context) {
      next.setScopeEnvironment({
        folderPath: '/Library/Research',
        listing: {
          files: [
            { format: 'md', path: 'MISSION.md' },
            { format: 'md', path: 'NOTES.md' },
            { format: 'md', path: 'research/screenshot-tools.md' },
            { format: 'pdf', path: 'reference/style-guide.pdf' },
          ],
          folders: ['assets', 'lessons', 'reference'],
        },
        readiness: { 'reference/style-guide.pdf': 'pending' },
        versions: {},
      });
      const session = next.activeSession();
      session.addContext({
        boundVersion: null,
        format: 'md',
        kind: 'source',
        source: { folderPath: '/Library/Research', path: 'research/screenshot-tools.md' },
      });
      session.addContext({
        boundVersion: null,
        format: 'pdf',
        kind: 'source',
        source: { folderPath: '/Library/Research', path: 'reference/style-guide.pdf' },
      });
      // Context first, then the draft: the editor's sync turns each known
      // `@path` run into an inline chip.
      session.setDraft(
        'Compare @research/screenshot-tools.md with @reference/style-guide.pdf and list gaps.',
      );
      void session.attachFiles([
        new File([STORY_IMAGE], 'workspace-cover.svg', { type: 'image/svg+xml' }),
      ]);
    }
    if (skills) {
      const session = next.activeSession();
      session.start();
      // The catalog arrives on the connection, so the armed skill waits for it.
      queueMicrotask(() => session.setSkill('review'));
    }
    return next;
  }, [context, empty, skills]);

  useEffect(() => () => runtime.dispose(), [runtime]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={cn('h-[46rem]', docked ? 'w-[36rem] border-l border-border' : 'w-[64rem]')}>
        <div className="flex h-11 items-center border-b border-border px-3">
          <AgentTitlebar runtime={runtime} />
        </div>
        <div className="h-[calc(100%-2.75rem)]">
          <ManagedAgentWorkspace
            catalog={{
              listAgents: async () => ({ agents: ready ? agents : pendingAgents }),
              prepareAgent: async () => ({ agents }),
            }}
            instructions={storyInstructions}
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

export const FullWorkspace: Story = { play: readyWorkspace };

export const EmptyWorkspace: Story = {
  args: { empty: true },
  play: readyWorkspace,
};

export const BoundContext: Story = {
  args: { context: true, empty: true },
  play: readyWorkspace,
};

export const ArmedSkill: Story = {
  args: { empty: true, skills: true },
  play: readyWorkspace,
};

export const Docked: Story = {
  args: { docked: true },
  parameters: { fluidCanvas: { minHeight: '50rem', width: '40rem' } },
  play: readyWorkspace,
};

/** Before any runtime is set up: the request can still be written, and the
 *  offer sits under the composer rather than in place of it. */
export const SetupOffer: Story = {
  args: { empty: true, ready: false },
  play: async () => {
    await screen.findByText('No Agent is ready yet.');
  },
};
