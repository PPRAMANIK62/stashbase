import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import { Tooltip } from './tooltip';

const meta = {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  parameters: { fluidCanvas: { width: '24rem', minHeight: '12rem' } },
  args: {
    content: 'Open search',
    children: <Button variant="secondary">Hover or focus</Button>,
  },
  argTypes: {
    side: { control: 'inline-radio', options: ['top', 'right', 'bottom', 'left'] },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj;

export const Playground: Story = {};
export const Visible: Story = { args: { forceOpen: true, side: 'right' } };
