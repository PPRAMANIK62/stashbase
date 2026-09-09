import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AgentPermissionMode } from '@/features/agent/ui/composer/permission-mode';
import type { AgentAccessMode } from '@/protocols/websocket/agent-session';

import { AgentActivityGroup, AgentPermissionCard } from './activity';
import type { AgentToolBlock } from './tool-presentation';

const tools: AgentToolBlock[] = [
  {
    id: 'read-1',
    input: { arguments: { path: 'design-docs/design/agent-panel.md' } },
    kind: 'tool',
    name: 'stashbase_read_file',
    result: 'Loaded the Agent Panel experience contract.',
    status: 'done',
  },
  {
    id: 'search-1',
    input: { pattern: 'permission', path: 'renderer/src/features/agent' },
    kind: 'tool',
    name: 'Search',
    status: 'done',
  },
  {
    id: 'command-1',
    input: { command: 'pnpm test:agent' },
    kind: 'tool',
    name: 'Bash',
    result: 'Running Agent contract tests…',
    status: 'running',
  },
];

const permission: AgentToolBlock = {
  id: 'permission-tool',
  input: { command: 'pnpm test:agent', cwd: '/Library/Research' },
  kind: 'tool',
  name: 'Bash',
  permissionId: 'permission-1',
  permissionRequested: true,
  permissionTitle: null,
  status: 'awaiting',
};

const PLAN_BEFORE = [
  '# Screenshot tools',
  '',
  '## Decision',
  '',
  'Undecided. Compare Screely, Screenshot.rocks, and Pika first.',
  '',
  '## Open questions',
  '',
  '- Which one exports SVG?',
  '- Does the free plan watermark?',
].join('\n');

const PLAN_AFTER = [
  '# Screenshot tools',
  '',
  '## Decision',
  '',
  'Use Screely for lesson screenshots: browser frames, gradients, and PNG export on the free plan.',
  '',
  '## Open questions',
  '',
  '- Does the free plan watermark?',
  '',
  '## Next steps',
  '',
  '- Export the three lesson screenshots and compare them side by side.',
].join('\n');

const editPermission: AgentToolBlock = {
  id: 'edit-permission',
  input: {
    file_path: '/Library/Research/notes/screenshot-tools.md',
    new_string: PLAN_AFTER.split('\n').slice(2, 6).join('\n'),
    old_string: PLAN_BEFORE.split('\n').slice(2, 6).join('\n'),
  },
  kind: 'tool',
  name: 'Edit',
  permissionId: 'permission-2',
  permissionRequested: true,
  permissionTitle: null,
  status: 'awaiting',
};

const fileChangeTools: AgentToolBlock[] = [
  {
    id: 'read-plan',
    input: { file_path: '/Library/Research/notes/screenshot-tools.md' },
    kind: 'tool',
    name: 'Read',
    result: PLAN_BEFORE,
    status: 'done',
  },
  {
    id: 'diff-plan',
    input: {
      additions: 6,
      after: `${PLAN_AFTER}\n`,
      before: `${PLAN_BEFORE}\n`,
      deletions: 2,
      path: 'notes/screenshot-tools.md',
    },
    kind: 'tool',
    name: 'FileDiff',
    status: 'done',
  },
  {
    id: 'write-summary',
    input: {
      content: '# Lesson screenshots\n\nExported with Screely on 2026-09-09.\n',
      file_path: '/Library/Research/notes/lesson-screenshots.md',
    },
    kind: 'tool',
    name: 'Write',
    status: 'done',
  },
  {
    id: 'codex-change',
    input: {
      changes: [
        {
          diff: '@@ -1,3 +1,3 @@\n # Assets\n-- pending\n+- three lesson screenshots\n done\n',
          kind: { type: 'update' },
          path: 'assets/README.md',
        },
      ],
    },
    kind: 'tool',
    name: 'File change',
    status: 'done',
  },
];

function FileChangeHarness() {
  const [decision, setDecision] = useState<AgentToolBlock>(editPermission);
  return (
    <div className="w-[34rem] space-y-5">
      <AgentPermissionCard
        onReply={(_toolUseId, _permissionId, allow) => {
          setDecision((tool) => ({
            ...tool,
            permissionId: undefined,
            status: allow ? 'running' : 'denied',
          }));
          return true;
        }}
        tool={decision}
      />
      <AgentActivityGroup
        onOpenSource={() => undefined}
        sourceFor={(path) => {
          const folder = '/Library/Research';
          const relative = path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;
          return relative.startsWith('/') ? null : { folderPath: folder, path: relative };
        }}
        tools={fileChangeTools}
      />
    </div>
  );
}

function AgentActivityHarness({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<AgentAccessMode>('auto');
  const [decision, setDecision] = useState<AgentToolBlock>(permission);
  return (
    <div className={compact ? 'w-[20rem] space-y-4' : 'w-[34rem] space-y-5'}>
      <AgentActivityGroup tools={tools} />
      <AgentPermissionCard
        onReply={(_toolUseId, _permissionId, allow) => {
          setDecision((tool) => ({
            ...tool,
            permissionId: undefined,
            status: allow ? 'running' : 'denied',
          }));
          return true;
        }}
        tool={decision}
      />
      <div className="flex justify-end">
        <AgentPermissionMode mode={mode} onChange={setMode} />
      </div>
    </div>
  );
}

const meta = {
  component: AgentActivityHarness,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '38rem', minHeight: '30rem' } },
  title: 'Agent/Activity and permissions',
} satisfies Meta<typeof AgentActivityHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};

export const FileChanges: Story = {
  render: () => <FileChangeHarness />,
};

export const Compact: Story = {
  args: { compact: true },
  parameters: { fluidCanvas: { width: '22rem', minHeight: '30rem' } },
};
