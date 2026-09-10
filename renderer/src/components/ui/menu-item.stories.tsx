import type { Meta, StoryObj } from '@storybook/react-vite';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from './button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from './dropdown';
import { MenuItem } from './menu-item';

const meta = {
  title: 'Navigation/Menu Item',
  component: MenuItem,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '26rem', minHeight: '14rem' } },
} satisfies Meta<typeof MenuItem>;

export default meta;
type Story = StoryObj;

/** A row is only ever a row of a surface — the surface supplies the primitive
 *  that owns the role and the roving highlight — so every story opens one. */
function OpenMenu({ children, label }: { children: ReactNode; label: string }) {
  return (
    <DropdownMenu defaultOpen>
      <DropdownTrigger render={<Button variant="secondary">{label}</Button>} />
      <DropdownContent aria-label={label}>{children}</DropdownContent>
    </DropdownMenu>
  );
}

/** Plain action rows. A row without `checked` announces as `menuitem`. */
export const Actions: Story = {
  render: () => (
    <OpenMenu label="Document actions">
      <MenuItem icon={Pencil} label="Rename" />
      <MenuItem icon={Copy} label="Duplicate" />
      <MenuItem disabled icon={Trash2} label="Delete" />
    </OpenMenu>
  ),
};

/** A boolean `checked` turns the row into a radio option and draws the check. */
export const Choices: Story = {
  render: function Choices() {
    const [selected, setSelected] = useState(1);
    const options = ['Newest first', 'Oldest first', 'Recently opened'];
    return (
      <OpenMenu label="Sort order">
        {options.map((label, index) => (
          <MenuItem
            checked={selected === index}
            key={label}
            label={label}
            onSelect={() => setSelected(index)}
          />
        ))}
      </OpenMenu>
    );
  },
};

/** Explanatory copy for a choice whose consequence the label cannot carry. */
export const WithDescription: Story = {
  render: () => (
    <OpenMenu label="Permission mode">
      <MenuItem description="Every edit is proposed for review." label="Ask first" />
      <MenuItem
        description="Edits inside the workspace apply immediately."
        label="Auto-accept edits"
      />
    </OpenMenu>
  ),
};

/** A compact secondary action at the row's trailing edge. */
export const WithTrailingAction: Story = {
  render: () => (
    <OpenMenu label="Recent chats">
      <MenuItem
        label="Indexing plan"
        trailingAction={{ icon: Trash2, label: 'Delete chat', onSelect: () => undefined }}
      />
      <MenuItem
        label="Release checklist"
        trailingAction={{ icon: Trash2, label: 'Delete chat', onSelect: () => undefined }}
      />
    </OpenMenu>
  ),
};
