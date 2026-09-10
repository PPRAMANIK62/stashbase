import type { Meta, StoryObj } from '@storybook/react-vite';

import { ThinkingIndicator } from './thinking-indicator';

const meta = {
  title: 'Feedback/Thinking Indicator',
  component: ThinkingIndicator,
  parameters: { fluidCanvas: { width: '24rem', minHeight: '10rem' } },
} satisfies Meta<typeof ThinkingIndicator>;

export default meta;
type Story = StoryObj;

export const Active: Story = {};
export const TextOnly: Story = { args: { showIcon: false } };
