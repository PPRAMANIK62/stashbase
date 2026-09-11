import type { Meta, StoryObj } from '@storybook/react-vite';

import { ConfirmDialog } from './confirm-dialog';

const meta = {
  title: 'Overlays/ConfirmDialog',
  component: ConfirmDialog,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '34rem', minHeight: '22rem' } },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

export const Confirm: Story = {
  args: {
    confirmLabel: 'Uninstall',
    description:
      'Uninstall the StashBase-managed runtime to free disk space? Your provider login and history are not affected.',
    onCancel: noop,
    onConfirm: noop,
    open: true,
    title: 'Uninstall runtime?',
  },
};

export const Destructive: Story = {
  args: {
    confirmLabel: 'Delete',
    description: 'The folder and everything inside it will be deleted from disk.',
    destructive: true,
    details: (
      <div className="max-w-full rounded-md bg-muted px-2.5 py-2 font-mono text-caption break-all text-muted-foreground">
        /library/notes/archive
      </div>
    ),
    onCancel: noop,
    onConfirm: noop,
    open: true,
    title: 'Delete folder?',
  },
};

export const Failed: Story = {
  args: {
    confirmLabel: 'Add',
    cancelLabel: 'Dismiss',
    description: 'There is an image on your clipboard. Add it to this folder?',
    failure: 'Could not save the clipboard image.',
    onCancel: noop,
    onConfirm: noop,
    open: true,
    title: 'Add image to StashBase?',
  },
};

export const Pending: Story = {
  args: {
    confirmLabel: 'Delete',
    description: 'The file will be deleted from disk. This cannot be undone.',
    destructive: true,
    onCancel: noop,
    onConfirm: noop,
    open: true,
    pending: true,
    title: 'Delete file?',
  },
};
