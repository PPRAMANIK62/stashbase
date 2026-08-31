import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge, badgeColors } from './badge';

const meta = {
  title: 'Data Display/Badge',
  component: Badge,
  parameters: { fluidCanvas: { width: '24rem', minHeight: '10rem' } },
  args: {
    children: 'Ready',
    color: 'green',
    variant: 'solid',
  },
  argTypes: {
    color: { control: 'select', options: Object.keys(badgeColors) },
    variant: { control: 'inline-radio', options: ['solid', 'dot'] },
    size: { control: 'inline-radio', options: ['default', 'compact'] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj;

export const Playground: Story = {};

export const StatusPalette: Story = {
  render: () => (
    <div className="flex max-w-xl flex-wrap gap-2">
      {Object.keys(badgeColors).map((color) => (
        <Badge color={color as keyof typeof badgeColors} key={color} variant="dot">
          {color}
        </Badge>
      ))}
    </div>
  ),
};
