import type { Meta, StoryObj } from '@storybook/react-vite';

import { ColorPicker, ColorPickerPopover } from './color-picker';

const meta = {
  title: 'Inputs/Color Picker',
  component: ColorPicker,
  args: { defaultValue: '#6B97FF' },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '24rem', minHeight: '18rem' } },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj;

export const Inline: Story = {};
export const Swatches: Story = {
  args: {
    swatches: ['#171717', '#FFFFFF', '#6B97FF', '#22C55E', '#F59E0B', '#EF4444'],
  },
};
export const Popover: Story = {
  render: () => <ColorPickerPopover defaultValue="#6B97FF" triggerLabel="Accent" />,
};
