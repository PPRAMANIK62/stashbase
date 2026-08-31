import type { Meta, StoryObj } from '@storybook/react-vite';
import { Folder, Settings, SquareLibrary } from 'lucide-react';
import { useState } from 'react';

import { Button } from './button';
import { MobileDrawer } from './mobile-drawer';

function DrawerExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="tertiary">
        Open navigation
      </Button>
      <MobileDrawer onClose={() => setOpen(false)} open={open}>
        <p className="mb-4 px-3 text-sm font-semibold">StashBase</p>
        <nav aria-label="Project navigation" className="flex flex-col gap-1">
          <Button className="w-full justify-start" leadingIcon={SquareLibrary} variant="ghost">
            Library
          </Button>
          <Button className="w-full justify-start" leadingIcon={Folder} variant="ghost">
            Projects
          </Button>
          <Button className="w-full justify-start" leadingIcon={Settings} variant="ghost">
            Settings
          </Button>
        </nav>
      </MobileDrawer>
    </>
  );
}

const meta = {
  title: 'Overlays/Mobile Drawer',
  component: MobileDrawer,
  parameters: {
    controls: { disable: true },
    fluidCanvas: { width: '24rem', minHeight: '34rem' },
    viewport: { defaultViewport: 'mobile1' },
  },
} satisfies Meta<typeof MobileDrawer>;

export default meta;
type Story = StoryObj;

export const Navigation: Story = { render: () => <DrawerExample /> };
