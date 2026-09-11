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

const keyed: EmbedderState = {
  authorized: true,
  hasKey: true,
  model: 'text-embedding-3-small',
  provider: 'openai',
  source: 'openai',
};

const notSetUp: EmbedderState = { ...keyed, authorized: false, hasKey: false };

function port(state: EmbedderState): EmbedderPort {
  return {
    load: async () => state,
    removeKey: async () => notSetUp,
    saveKey: async () => ({ warning: null }),
  };
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

/** A key stored and answering: the one state in which search by meaning is on. */
export const KeyActive: Story = { render: () => <AiIndexPanel embedderApi={port(keyed)} /> };

/** The default: nothing configured, and the editor open because there is
 *  nothing else on the row to do. */
export const NotSetUp: Story = { render: () => <AiIndexPanel embedderApi={port(notSetUp)} /> };
