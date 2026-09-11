import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { CapturePort } from '@/features/settings/application/ports';
import type { SoftwareUpdateRow } from '@/shared/domain/software-update';

import { GeneralPanel } from './general-panel';

function Queries({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const capturePort: CapturePort = {
  load: async () => ({ clipboardImageImport: true }),
  update: async (next) => next,
};

const softwareUpdate: SoftwareUpdateRow = {
  autoCheckEnabled: true,
  busy: false,
  check: () => undefined,
  failure: null,
  setAutoCheck: () => undefined,
  status: 'StashBase is up to date.',
  version: '2.0.0',
};

function GeneralHarness({ updates = null }: { updates?: SoftwareUpdateRow | null }) {
  return (
    <GeneralPanel
      applyCaptureWatch={async () => true}
      captureApi={capturePort}
      onReportBug={() => undefined}
      softwareUpdate={updates}
    />
  );
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

/** A build with no updater behind it: General says nothing about updates. */
export const Default: Story = { render: () => <GeneralHarness /> };

/** A packaged build, where the running version and the auto-check choice both
 *  have a home. */
export const WithSoftwareUpdates: Story = {
  render: () => <GeneralHarness updates={softwareUpdate} />,
};
