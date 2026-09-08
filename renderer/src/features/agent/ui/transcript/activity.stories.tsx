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

export const Compact: Story = {
  args: { compact: true },
  parameters: { fluidCanvas: { width: '22rem', minHeight: '30rem' } },
};
