import type { Meta, StoryObj } from '@storybook/react-vite';

import { MarkdownReviewBar, reviewWording } from './review-bar';

import './document.css';

const meta = {
  component: MarkdownReviewBar,
  title: 'Documents/Markdown Review Bar',
  parameters: { fluidCanvas: { width: '40rem', minHeight: '8rem' } },
  args: {
    onAcceptAll: () => undefined,
    onRejectAll: () => undefined,
    pending: 4,
    wording: reviewWording({ kind: 'agent' }),
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-24 bg-surface-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MarkdownReviewBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LastChange: Story = { args: { pending: 1 } };
export const TurnReview: Story = {
  args: { wording: reviewWording({ kind: 'turn', turnId: 'turn-1' }) },
};
