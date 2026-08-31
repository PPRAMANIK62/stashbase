import type { Meta, StoryObj } from '@storybook/react-vite';
import { Folder, Globe, Settings } from 'lucide-react';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from './select';

function SelectExample() {
  const [value, setValue] = useState('project');
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger icon={Folder} placeholder="Choose scope" />
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Search scope</SelectLabel>
          <SelectItem icon={Folder} index={0} value="project">
            Current project
          </SelectItem>
          <SelectItem icon={Globe} index={1} value="workspace">
            Entire workspace
          </SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectItem icon={Settings} index={2} value="custom">
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

export const Error: Story = {
  render: () => (
    <Select>
      <SelectTrigger error="Choose a project before continuing." placeholder="Choose project" />
      <SelectContent>
        <SelectItem index={0} value="research">
          Research
        </SelectItem>
      </SelectContent>
    </Select>
  ),
};
