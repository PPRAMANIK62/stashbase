import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { AgentRuntimePort } from '@/features/settings/application/ports';
import type { AgentCatalog, AgentRuntime } from '@/features/settings/domain/agent-catalog';

import { AgentRuntimesPanel } from './agents-panel';

function catalog(runtimes: AgentRuntime[]): AgentCatalog {
  return { runtimes, debug: null };
}

const codex: AgentRuntime = {
  id: 'codex',
  label: 'Codex',
  installed: true,
  ownership: 'system',
  preparation: { kind: 'ready' },
};

const claude: AgentRuntime = {
  id: 'claude',
  label: 'Claude Code',
  installed: true,
  ownership: 'system',
  preparation: { kind: 'ready' },
};

const stashbase: AgentRuntime = {
  id: 'stashbase',
  label: 'Built-in',
  installed: true,
  ownership: 'bundled',
  preparation: { kind: 'ready' },
};

function fakePort(): AgentRuntimePort {
  return {
    getAllowance: async () => ({
      remainingPercent: 62,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
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
  return (
    <QueryClientProvider client={queryClient}>
      <AgentRuntimesPanel agentRuntimeApi={fakePort()} />
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Settings/AgentRuntimesPanel',
  component: Harness,
  parameters: { fluidCanvas: { width: '28rem', minHeight: '30rem' } },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj;

export const Ready: Story = {};
