import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import type { EmbedderState } from '@/features/settings/domain/embedder';

import { AiIndexPanel } from './ai-index-panel';

function Queries({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const signedIn: EmbedderState = {
  account: {
    active: true,
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    quota: {
      grantedTokens: 5_000_000,
      periodEndsAt: '2026-09-16T00:00:00.000Z',
      periodStartedAt: '2026-08-16T00:00:00.000Z',
      plan: 'free',
      remainingTokens: 3_972_764,
      reservedTokens: 0,
      usedTokens: 1_027_236,
    },
    quotaUnavailable: false,
    signedIn: true,
  },
  authorized: true,
  hasKey: false,
  model: 'hosted',
  provider: 'openai',
  source: 'stashbase-account',
};

const embedderPort: EmbedderPort = {
  load: async () => signedIn,
  refreshAccount: async () => signedIn.account,
  removeKey: async () => signedIn,
  saveKey: async () => ({ warning: null }),
  selectProvider: async () => signedIn,
  signInStatus: async () => ({ state: 'pending' }),
  signOut: async () => undefined,
  startSignIn: async () => ({ flowId: 'flow', url: 'https://accounts.example/sign-in' }),
  useAccount: async () => signedIn.account,
};

function AiIndexHarness() {
  return <AiIndexPanel embedderApi={embedderPort} onOpenExternal={() => undefined} />;
}

const meta = {
  title: 'Settings/AiIndexPanel',
  parameters: { fluidCanvas: { width: '40rem', minHeight: '24rem' } },
  decorators: [
    (Story) => (
      <Queries>
        <Story />
      </Queries>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const SignedIn: Story = { render: () => <AiIndexHarness /> };
