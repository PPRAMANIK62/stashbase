import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

const meta = {
  title: 'Overlays/Dialog',
  component: Dialog,
  subcomponents: { DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '34rem', minHeight: '22rem' } },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj;

export const CreateProject: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="tertiary">Open dialog</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Choose a folder to make its documents available in this workspace.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button>Create project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Open: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove folder?</DialogTitle>
          <DialogDescription>The source files stay on disk.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Keep folder</Button>} />
          <Button>Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
