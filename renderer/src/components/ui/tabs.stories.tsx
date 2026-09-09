import type { Meta, StoryObj } from '@storybook/react-vite';
import { Clock, Settings, SquareLibrary, Star, X } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { SizeProvider } from '@/lib/size-context';

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

/** Controlled by value, which is the only control model the segmented tabs
 *  have: the caller owns the selected tab's value and hears about every
 *  change. Tabs take no index — they read their own position from where they
 *  sit, so a conditional tab renumbers nothing. */
export const Controlled: Story = {
  render: function Controlled() {
    const [value, setValue] = useState('recents');
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <Tabs onValueChange={setValue} value={value}>
          <TabsList aria-label="Workspace sections">
            <TabItem icon={SquareLibrary} label="Library" value="library" />
            <TabItem icon={Clock} label="Recents" value="recents" />
            <TabItem icon={Star} label="Favorites" value="favorites" />
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">Showing: {value}</p>
      </div>
    );
  },
  // Keyboard first: the strip is a roving tab stop, so arrows move focus and
  // Enter is what selects. Scoring the story after that puts the run in the
  // state a keyboard user leaves it in rather than the one a click does.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const recents = canvas.getByRole('tab', { name: 'Recents' });
    recents.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Favorites' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('tab', { name: 'Favorites' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  },
};

/** A trailing glyph on each tab — a close affordance for an open document.
 *  The tab stays the only semantic control; Delete is its keyboard equivalent. */
export const Closable: Story = {
  render: () => (
    <Tabs className="mx-auto w-full max-w-xl" defaultValue="notes">
      <TabsList aria-label="Open documents">
        <TabItem
          label="Research notes.md"
          onTrailingClick={() => undefined}
          trailingIcon={X}
          value="notes"
        />
        <TabItem
          label="Quarterly report.pdf"
          onTrailingClick={() => undefined}
          trailingIcon={X}
          value="report"
        />
      </TabsList>
      <TabPanel className="pt-4 text-muted-foreground" value="notes">
        Research notes.
      </TabPanel>
      <TabPanel className="pt-4 text-muted-foreground" value="report">
        Quarterly report.
      </TabPanel>
    </Tabs>
  ),
};

/** The compact step: a 28px track for a toolbar or a filter bar. */
export const Compact: Story = {
  render: () => (
    <SizeProvider size="compact">
      <Tabs className="mx-auto w-full max-w-xl" defaultValue="library">
        <TabsList aria-label="Workspace sections">
          <TabItem icon={SquareLibrary} label="Library" value="library" />
          <TabItem icon={Clock} label="Recents" value="recents" />
          <TabItem icon={Settings} label="Settings" value="settings" />
        </TabsList>
      </Tabs>
    </SizeProvider>
  ),
};
