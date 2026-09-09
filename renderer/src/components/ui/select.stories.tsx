import type { Meta, StoryObj } from '@storybook/react-vite';
import { Folder, Globe, Settings } from 'lucide-react';
import { useState } from 'react';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  type SelectOption,
} from './select';

// Grouping and separators are popup furniture; `items` stays a flat list of
// the options themselves, in row order.
const SCOPES: readonly SelectOption[] = [
  { value: 'project', label: 'Current project' },
  { value: 'workspace', label: 'Entire workspace' },
  { value: 'custom', label: 'Custom folders' },
];

const PROJECTS: readonly SelectOption[] = [{ value: 'research', label: 'Research' }];

function SelectExample() {
  const [value, setValue] = useState('project');
  return (
    <Select items={SCOPES} value={value} onValueChange={setValue}>
      <SelectTrigger icon={Folder} placeholder="Choose scope" />
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Search scope</SelectLabel>
          <SelectItem icon={Folder} value="project">
            Current project
          </SelectItem>
          <SelectItem icon={Globe} value="workspace">
            Entire workspace
          </SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectItem icon={Settings} value="custom">
          Custom folders
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

const meta = {
  title: 'Inputs/Select',
  component: Select,
  subcomponents: { SelectTrigger, SelectContent, SelectItem, SelectGroup, SelectLabel },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '28rem', minHeight: '16rem' } },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj;

export const GroupedOptions: Story = { render: () => <SelectExample /> };

/** The popup mounts only while it is open — the group, its label, the
 *  separator and the rows are all unscored until something opens it. The play
 *  then walks the rows with the keyboard and commits with Enter, so the roving
 *  highlight and the option the trigger names are scored in the state a
 *  keyboard user actually sees them in. */
export const OpenOptions: Story = {
  render: () => <SelectExample />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('combobox');
    await userEvent.click(trigger);
    // The listbox portals out of the canvas, so it is found on the screen.
    await waitFor(() => expect(screen.getByRole('listbox')).toBeVisible());
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Entire workspace/ })).toHaveAttribute(
        'data-highlighted',
      ),
    );
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(trigger).toHaveTextContent('Entire workspace'));
  },
};

export const Error: Story = {
  render: () => (
    <Select items={PROJECTS}>
      <SelectTrigger error="Choose a project before continuing." placeholder="Choose project" />
      <SelectContent>
        <SelectItem value="research">Research</SelectItem>
      </SelectContent>
    </Select>
  ),
};
