import type { Meta, StoryObj } from '@storybook/react-vite';
import { Clock, Settings, SquareLibrary, Star } from 'lucide-react';

import { TabItem, TabPanel, Tabs, TabsList } from './tabs';

const meta = {
  title: 'Navigation/Tabs',
  component: Tabs,
  subcomponents: { TabsList, TabItem, TabPanel },
  parameters: { fluidCanvas: { width: '36rem', minHeight: '20rem' }, layout: 'padded' },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj;

export const WorkspaceSections: Story = {
  render: () => (
    <Tabs className="mx-auto w-full max-w-xl" defaultValue="library">
      <TabsList>
        <TabItem icon={SquareLibrary} label="Library" value="library" />
        <TabItem icon={Clock} label="Recents" value="recents" />
        <TabItem icon={Star} label="Favorites" value="favorites" />
        <TabItem icon={Settings} label="Settings" value="settings" />
      </TabsList>
      <TabPanel className="pt-4 text-muted-foreground" value="library">
        Documents from every folder in this workspace.
      </TabPanel>
      <TabPanel className="pt-4 text-muted-foreground" value="recents">
        Files opened recently.
      </TabPanel>
      <TabPanel className="pt-4 text-muted-foreground" value="favorites">
        Starred documents.
      </TabPanel>
      <TabPanel className="pt-4 text-muted-foreground" value="settings">
        Workspace preferences.
      </TabPanel>
    </Tabs>
  ),
};
