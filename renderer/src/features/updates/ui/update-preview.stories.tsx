import type { Meta, StoryObj } from '@storybook/react-vite';

import { UpdatePreview } from './update-preview';

const meta = {
  component: UpdatePreview,
  title: 'Feedback/Update Preview',
  parameters: { fluidCanvas: { width: '40rem', minHeight: '16rem' } },
  args: { active: false, onShow: () => undefined, onStop: () => undefined },
} satisfies Meta<typeof UpdatePreview>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
