import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { AgentRuntimePort } from '@/features/settings/application/ports';
import { useAgentRuntimes } from '@/features/settings/hooks/use-agent-runtimes';
import type { Agent, AgentsResponse } from '@/shared/agent-runtime';

import { AgentRuntimesPanel } from './agents-panel';

function catalog(clis: Agent[]): AgentsResponse {
  return { clis };
}

const codex: Agent = {
  id: 'codex',
  label: 'Codex',
  vendor: 'OpenAI',
  installHint: '',
  installed: true,
  source: 'system',
  bootstrap: { phase: 'ready' },
  launchCommand: 'codex',
};

const claude: Agent = {
  id: 'claude',
  label: 'Claude Code',
  vendor: 'Anthropic',
  installHint: '',
  installed: true,
  source: 'system',
  bootstrap: { phase: 'ready' },
  launchCommand: 'claude',
};

const stashbase: Agent = {
  id: 'stashbase',
  label: 'Built-in',
  vendor: 'StashBase',
  installHint: '',
  installed: true,
  source: 'bundled',
  bootstrap: { phase: 'ready' },
  launchCommand: 'stashbase',
};

function fakePort(): AgentRuntimePort {
  return {
    getAllowance: async () => ({
      profile: 'stashbase-agent-default',
      remainingPercent: 62,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      windowStartedAt: null,
      windowEndsAt: null,
    }),
    listAgents: async () => catalog([codex, claude, stashbase]),
    prepareAgent: async () => catalog([codex, claude, stashbase]),
    resetManagedAgent: async () => catalog([codex, claude, stashbase]),
    updateDebug: async () => catalog([codex, claude, stashbase]),
  };
}

function Harness() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const port = fakePort();
  return (
    <QueryClientProvider client={queryClient}>
      <Inner port={port} />
    </QueryClientProvider>
  );
}

function Inner({ port }: { port: AgentRuntimePort }) {
  const runtimes = useAgentRuntimes(port);
  return <AgentRuntimesPanel runtimes={runtimes} />;
}

const meta = {
  title: 'Settings/AgentRuntimesPanel',
  component: Harness,
  parameters: { fluidCanvas: { width: '28rem', minHeight: '30rem' } },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj;

export const Ready: Story = {};
