import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AgentRevisionCard, type AgentRevisionReview } from './revision-card';

/** The card reads a live count, so the harness holds one and the buttons move
 *  it the way the document's diff plugin would. */
function RevisionHarness({ pending = 3 }: { pending?: number }) {
  const [open, setOpen] = useState<AgentRevisionReview | null>({
    acceptAll: () => setOpen(null),
    pending,
    rejectAll: () => setOpen(null),
  });
  return (
    <div className="w-[34rem] space-y-5">
      <AgentRevisionCard name="screenshot-tools.md" review={open} />
    </div>
  );
}

const meta = {
  component: RevisionHarness,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '38rem', minHeight: '16rem' } },
  title: 'Agent/Revision review',
} satisfies Meta<typeof RevisionHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};

/** One change left to decide, which the count says in the singular. */
export const SingleChange: Story = {
  args: { pending: 1 },
};

/** A review the reader has already ended, or one the document no longer
 *  holds: the card says so rather than leaving dead buttons behind. */
export const Decided: Story = {
  render: () => (
    <div className="w-[34rem]">
      <AgentRevisionCard name="screenshot-tools.md" review={null} />
    </div>
  ),
};
