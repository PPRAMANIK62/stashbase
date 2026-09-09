import type { Meta, StoryObj } from '@storybook/react-vite';
import { Clock, SquareLibrary, Star, Users } from 'lucide-react';
import { useState } from 'react';

import { TabsSubtle, TabsSubtleItem, TabsSubtlePanel } from './tabs-subtle';

const items = [
  { icon: SquareLibrary, label: 'Teamspaces' },
  { icon: Clock, label: 'Recents' },
  { icon: Star, label: 'Favorites' },
  { icon: Users, label: 'Shared' },
];

function SubtleTabsExample({ activeLabel = false }: { activeLabel?: boolean }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="w-full max-w-xl">
      <TabsSubtle
        activeLabel={activeLabel}
        idPrefix={activeLabel ? 'active-label' : 'subtle'}
        onSelect={setSelected}
        selectedIndex={selected}
      >
        {items.map((item) => (
          <TabsSubtleItem key={item.label} {...item} />
        ))}
      </TabsSubtle>
      {items.map((item, index) => (
        <TabsSubtlePanel
          className="px-3 pt-4 text-muted-foreground"
          idPrefix={activeLabel ? 'active-label' : 'subtle'}
          index={index}
          key={item.label}
          selectedIndex={selected}
        >
          {item.label} documents.
        </TabsSubtlePanel>
      ))}
    </div>
  );
}

const meta = {
  title: 'Navigation/Subtle Tabs',
  component: TabsSubtle,
  subcomponents: { TabsSubtleItem, TabsSubtlePanel },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '36rem', minHeight: '20rem' } },
} satisfies Meta<typeof TabsSubtle>;

export default meta;
type Story = StoryObj;

export const FullLabels: Story = { render: () => <SubtleTabsExample /> };
export const ActiveLabel: Story = { render: () => <SubtleTabsExample activeLabel /> };
