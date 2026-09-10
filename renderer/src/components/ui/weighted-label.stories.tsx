import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { Button } from './button';
import { WeightedLabel } from './weighted-label';

const meta = {
  title: 'Data Display/Weighted Label',
  component: WeightedLabel,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '26rem', minHeight: '16rem' } },
} satisfies Meta<typeof WeightedLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The two weights, one above the other. They occupy the same width — that is
 *  the whole point of the component — so the trailing rule stays put. */
export const Weights: Story = {
  args: { children: 'Quarterly report', emphasized: false },
  render: (args) => (
    <div className="flex flex-col gap-2 text-body">
      <span className="flex items-center gap-2">
        <WeightedLabel {...args} emphasized={false} />
        <span aria-hidden className="h-px flex-1 bg-border" />
      </span>
      <span className="flex items-center gap-2">
        <WeightedLabel {...args} emphasized />
        <span aria-hidden className="h-px flex-1 bg-border" />
      </span>
    </div>
  ),
};

/** The reservation, shown by driving it: pressing the button thickens the
 *  label, and nothing after it moves. A story that only rendered one state
 *  could not show that, because the bug it prevents is a transition. */
function SelectableRow() {
  const [emphasized, setEmphasized] = useState(false);
  return (
    <div className="flex items-center gap-2 text-body">
      <WeightedLabel emphasized={emphasized} lit={emphasized}>
        Quarterly report
      </WeightedLabel>
      <span className="text-caption text-muted-foreground">12 documents</span>
      <Button onClick={() => setEmphasized((value) => !value)} size="compact" variant="ghost">
        Select
      </Button>
    </div>
  );
}

export const NoReflowOnEmphasis: Story = {
  args: { children: 'Quarterly report', emphasized: false },
  render: () => <SelectableRow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Select' }));
    // Two copies by design: the invisible sizer that reserves the heavy
    // width, and the visible copy that animates inside it. One copy would
    // mean the reservation is gone and the row reflows on selection.
    await expect(canvas.getAllByText('Quarterly report')).toHaveLength(2);
  },
};

/** The overflow rules, each in a box narrower than its label. */
export const Overflow: Story = {
  args: { children: 'A document title long enough to run past its box', emphasized: false },
  render: (args) => (
    <div className="flex flex-col gap-3 text-body">
      {(['truncate', 'ellipsis', 'wrap'] as const).map((overflow) => (
        <span className="flex items-baseline gap-2" key={overflow}>
          <span className="w-20 shrink-0 text-caption text-muted-foreground">{overflow}</span>
          <span className="w-48 rounded-md bg-hover px-2 py-1">
            <WeightedLabel {...args} overflow={overflow} />
          </span>
        </span>
      ))}
    </div>
  ),
};
