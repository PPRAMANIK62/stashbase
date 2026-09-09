import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { CapturePort } from '@/features/settings/application/ports';
import { useCapture } from '@/features/settings/hooks/use-capture';

import { GeneralPanel } from './general-panel';

function Queries({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const capturePort: CapturePort = {
  load: async () => ({ clipboardImageImport: true }),
  update: async (next) => next,
};

function GeneralHarness() {
  const capture = useCapture(capturePort, async () => true);
  return <GeneralPanel capture={capture} />;
}

const meta = {
  title: 'Settings/GeneralPanel',
  parameters: { fluidCanvas: { width: '40rem', minHeight: '20rem' } },
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

export const Default: Story = { render: () => <GeneralHarness /> };
