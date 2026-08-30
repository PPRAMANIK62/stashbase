import type { Meta, StoryObj } from '@storybook/react-vite';

import { App } from './app';

const meta = {
  title: 'Foundation/Replacement Renderer',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
