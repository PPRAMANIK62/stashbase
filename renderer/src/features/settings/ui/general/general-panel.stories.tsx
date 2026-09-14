import type { Meta, StoryObj } from '@storybook/react-vite';

import type { SoftwareUpdateRow } from '@/shared/domain/software-update';

import { GeneralPanel } from './general-panel';

const softwareUpdate: SoftwareUpdateRow = {
  autoCheckEnabled: true,
  busy: false,
  actionLabel: 'Check for updates',
  act: () => undefined,
  failure: null,
  setAutoCheck: () => undefined,
  status: 'StashBase is up to date.',
  version: '2.0.0',
};

function GeneralHarness({ updates = null }: { updates?: SoftwareUpdateRow | null }) {
  return <GeneralPanel onReportBug={() => undefined} softwareUpdate={updates} />;
}

const meta = {
  title: 'Settings/GeneralPanel',
  parameters: { fluidCanvas: { width: '40rem', minHeight: '20rem' } },
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

export const ComponentDownloadFailed: Story = {
  render: () => (
    <GeneralPanel
      onReportBug={() => undefined}
      softwareUpdate={softwareUpdate}
      localComponent={{
        busy: false,
        canRetry: true,
        description:
          'The download could not finish. Check your connection and retry. Waiting files stay queued. Retry here or restart StashBase to try again.',
        failure: null,
        retry: () => undefined,
        reload: () => undefined,
      }}
    />
  ),
};
