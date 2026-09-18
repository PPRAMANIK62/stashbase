import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { AccountPort, AgentRuntimePort } from '@/features/settings/application/ports';
import type { AgentCatalog, AgentRuntime } from '@/features/settings/domain/agent-catalog';
import { AccountProvider } from '@/features/settings/hooks/account-context';

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
  updatable: true,
  version: '0.155.0',
};

const claude: AgentRuntime = {
  id: 'claude',
  label: 'Claude',
  installed: true,
  ownership: 'system',
  preparation: { kind: 'ready' },
  updatable: true,
  version: '2.1.276',
};

const stashbase: AgentRuntime = {
  id: 'stashbase',
  label: 'Default',
  installed: true,
  ownership: 'bundled',
  preparation: { kind: 'ready' },
  updatable: false,
  version: null,
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
    updateDebug: async () => catalog([codex, claude, stashbase]),
  };
}

const signedIn: AccountPort = {
  avatar: async () => null,
  load: async () => ({
    avatarUrl: null,
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    signedIn: true,
  }),
  signInStatus: async () => ({ state: 'pending' }),
  signOut: async () => ({ avatarUrl: null, displayName: null, email: null, signedIn: false }),
  startSignIn: async () => ({ flowId: 'flow', url: 'https://accounts.example/sign-in' }),
};

/** Nobody signed in, so the bundled agent cannot run a turn yet: the row
 *  recedes and says what would clear it, and the account row above offers the
 *  same sign-in in the same shape. */
const signedOut: AccountPort = {
  ...signedIn,
  load: async () => ({ avatarUrl: null, displayName: null, email: null, signedIn: false }),
};

function accountRequiredPort(): AgentRuntimePort {
  const blocked: AgentRuntime = {
    ...stashbase,
    preparation: {
      kind: 'failed',
      failure: {
        note: 'Sign in to StashBase to use the included weekly Agent allowance.',
        refusal: 'account-required',
        stage: 'authenticate',
      },
    },
  };
  const runtimes = [codex, { ...claude, installed: false, ownership: null }, blocked];
  return {
    ...fakePort(),
    getAllowance: async () => {
      throw new Error('unauthorized');
    },
    listAgents: async () => catalog(runtimes),
  };
}

function Harness({ account, port }: { account: AccountPort; port: AgentRuntimePort }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider port={account} openExternal={() => undefined}>
        <AgentRuntimesPanel agentRuntimeApi={port} />
      </AccountProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Settings/AgentRuntimesPanel',
  component: Harness,
  parameters: { fluidCanvas: { width: '28rem', minHeight: '30rem' } },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof Harness>;

export const Ready: Story = { args: { account: signedIn, port: fakePort() } };

export const NeedsSignIn: Story = { args: { account: signedOut, port: accountRequiredPort() } };
