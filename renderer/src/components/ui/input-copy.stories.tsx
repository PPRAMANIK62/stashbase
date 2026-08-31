import type { Meta, StoryObj } from '@storybook/react-vite';

import { InputCopy } from './input-copy';

const meta = {
  title: 'Inputs/Input Copy',
  component: InputCopy,
  parameters: { fluidCanvas: { width: '36rem', minHeight: '12rem' } },
  args: {
    label: 'Install command',
    value: 'npx shadcn@latest add @fluid/base/button',
  },
  argTypes: {
    align: { control: 'inline-radio', options: ['left', 'right'] },
    variant: { control: 'inline-radio', options: ['icon', 'button'] },
  },
  decorators: [
    (Story) => (
      <div className="w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InputCopy>;

export default meta;
type Story = StoryObj;

export const Playground: Story = {};
export const VisibleButton: Story = { args: { variant: 'button' } };
export const Disabled: Story = { args: { disabled: true, value: 'Unavailable' } };
