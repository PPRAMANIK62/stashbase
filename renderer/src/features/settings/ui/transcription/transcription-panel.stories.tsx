import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { TranscriptionPort } from '@/features/settings/application/ports';
import type { TranscriptionSettings } from '@/features/settings/domain/transcription';

import { TranscriptionPanel } from './transcription-panel';

function Queries({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const transcriptionSettings: TranscriptionSettings = {
  language: 'auto',
  modelId: 'small',
  providerId: 'local',
  providers: [
    {
      description: 'Runs entirely on this device with downloaded Whisper weights.',
      id: 'local',
      kind: 'local',
      label: 'Local whisper.cpp',
      models: [
        {
          accuracy: 'Basic accuracy',
          available: false,
          id: 'tiny',
          label: 'Tiny',
          management: 'local-download',
          operation: { status: 'idle' },
          resourceUse: 'Lowest CPU and memory use',
          sizeBytes: 74 * 1024 * 1024,
          speed: 'Fastest',
        },
        {
          accuracy: 'Balanced accuracy',
          available: false,
          id: 'base',
          label: 'Base',
          management: 'local-download',
          operation: { receivedBytes: 61, status: 'downloading', totalBytes: 100 },
          resourceUse: 'Low CPU and memory use',
          sizeBytes: 141 * 1024 * 1024,
          speed: 'Fast',
        },
        {
          accuracy: 'Best accuracy of the three',
          available: true,
          id: 'small',
          label: 'Small',
          management: 'local-download',
          operation: { status: 'idle' },
          resourceUse: 'Higher CPU and memory use',
          sizeBytes: 465 * 1024 * 1024,
          speed: 'Slower',
        },
      ],
      runtimeError: 'whisper-cli is missing; run pnpm build:transcription-sidecar',
    },
  ],
};

const transcriptionPort: TranscriptionPort = {
  downloadModel: async () => ({ receivedBytes: 0, status: 'downloading', totalBytes: 1 }),
  load: async () => transcriptionSettings,
  removeModel: async () => undefined,
  updatePreferences: async (next) => ({
    language: next.language ?? 'auto',
    modelId: next.modelId ?? 'small',
    providerId: next.providerId ?? 'local',
  }),
};

function TranscriptionHarness() {
  return <TranscriptionPanel transcriptionApi={transcriptionPort} />;
}

const meta = {
  title: 'Settings/TranscriptionPanel',
  parameters: { fluidCanvas: { width: '40rem', minHeight: '32rem' } },
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

export const LocalEngine: Story = { render: () => <TranscriptionHarness /> };
