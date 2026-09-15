import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import type { TelemetryPort } from '@/features/settings/application/telemetry-port';
import { TelemetryNotice } from '@/features/settings/ui/telemetry-notice';

import { GeneralPanel } from './general-panel';

function Harness({ notice = false, enabled = true }: { notice?: boolean; enabled?: boolean }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  const [port] = useState<TelemetryPort>(() => {
    let saved = { enabled, noticeSeen: !notice, available: true };
    return {
      load: async () => saved,
      update: async (change) => {
        saved = { ...saved, ...change };
        return saved;
      },
    };
  });
  return (
    <QueryClientProvider client={client}>
      {notice ? (
        <TelemetryNotice port={port} />
      ) : (
        <GeneralPanel
          telemetryApi={port}
          onOpenExternal={() => undefined}
          onReportBug={() => undefined}
          softwareUpdate={null}
        />
      )}
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Settings/UsageStatistics',
  parameters: { fluidCanvas: { width: '40rem', minHeight: '20rem' } },
} satisfies Meta;
export default meta;
type Story = StoryObj;
export const Enabled: Story = { render: () => <Harness /> };
export const Disabled: Story = { render: () => <Harness enabled={false} /> };
export const FirstLaunch: Story = { render: () => <Harness notice /> };
