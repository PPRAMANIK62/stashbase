import type { Meta, StoryObj } from '@storybook/react-vite';
import { Clock, Settings, SquareLibrary, Star } from 'lucide-react';
import { useState } from 'react';

import { Button } from './button';
import {
  Dropdown,
  DropdownContent,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from './dropdown';
import { MenuItem } from './menu-item';

const views = [
  { icon: SquareLibrary, label: 'Library' },
  { icon: Clock, label: 'Recents' },
  { icon: Star, label: 'Favorites' },
];

function InlineDropdown() {
  const [selected, setSelected] = useState(0);
  return (
    <Dropdown aria-label="Library view" checkedIndex={selected}>
      <DropdownLabel>View</DropdownLabel>
      {views.map((item, index) => (
        <MenuItem
          checked={selected === index}
          index={index}
          key={item.label}
          onSelect={() => setSelected(index)}
          {...item}
        />
      ))}
      <DropdownSeparator />
      <MenuItem icon={Settings} index={3} label="View settings" />
    </Dropdown>
  );
}

const meta = {
  title: 'Navigation/Dropdown',
  component: Dropdown,
  subcomponents: { MenuItem, DropdownMenu, DropdownTrigger, DropdownContent },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '26rem', minHeight: '16rem' } },
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj;

export const InlinePanel: Story = { render: () => <InlineDropdown /> };

export const TriggeredMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownTrigger render={<Button variant="secondary">Open menu</Button>} />
      <DropdownContent>
        {views.map((item, index) => (
          <MenuItem index={index} key={item.label} {...item} />
        ))}
      </DropdownContent>
    </DropdownMenu>
  ),
};
