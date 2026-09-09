import type { Meta, StoryObj } from '@storybook/react-vite';
import { Clock, Settings, SquareLibrary, Star } from 'lucide-react';
import { useState } from 'react';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

import { Button } from './button';
import {
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

const meta = {
  title: 'Navigation/Dropdown',
  component: DropdownMenu,
  subcomponents: { MenuItem, DropdownTrigger, DropdownContent },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '26rem', minHeight: '16rem' } },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj;

export const TriggeredMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownTrigger render={<Button variant="secondary">Open menu</Button>} />
      <DropdownContent>
        {views.map((item) => (
          <MenuItem key={item.label} {...item} />
        ))}
      </DropdownContent>
    </DropdownMenu>
  ),
  // The rows are the story, and they exist only once the popup is open. Left
  // closed, every rule the accessibility run applies here would be applied to
  // a single button.
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open menu' }));
    // The popup portals out of the canvas, so it is found on the screen.
    await waitFor(() => expect(screen.getByRole('menu')).toBeVisible());
  },
};

/** The same popup, opened by the story rather than by a pointer — so the
 *  rows are on screen for a reader flipping through the catalogue. */
export const OpenMenu: Story = {
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownTrigger render={<Button variant="secondary">Library view</Button>} />
      <DropdownContent>
        {views.map((item) => (
          <MenuItem key={item.label} {...item} />
        ))}
      </DropdownContent>
    </DropdownMenu>
  ),
};

/** A captioned group of radio rows with a separated action under it — the
 *  shape a "view" menu takes. */
function GroupedMenu() {
  const [selected, setSelected] = useState(0);
  return (
    <DropdownMenu defaultOpen>
      <DropdownTrigger render={<Button variant="secondary">Library view</Button>} />
      <DropdownContent aria-label="Library view">
        <DropdownLabel>View</DropdownLabel>
        {views.map((item, index) => (
          <MenuItem
            checked={selected === index}
            key={item.label}
            onSelect={() => setSelected(index)}
            {...item}
          />
        ))}
        <DropdownSeparator />
        <MenuItem icon={Settings} label="View settings" />
      </DropdownContent>
    </DropdownMenu>
  );
}

/** Keyboard traversal: the popup opens with the arrow keys and the highlight
 *  rovers through the rows, which is the behaviour the roving tab stop and
 *  `aria-activedescendant` exist for. */
export const Grouped: Story = {
  render: () => <GroupedMenu />,
  play: async () => {
    const rows = await screen.findAllByRole('menuitemradio');
    rows[0]?.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(rows[1]).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(rows[2]).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.getAllByRole('menuitemradio')[2]).toBeVisible());
  },
};
