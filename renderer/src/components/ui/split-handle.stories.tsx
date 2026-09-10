import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SplitHandle } from './split-handle';

const meta = {
  title: 'Navigation/Split Handle',
  component: SplitHandle,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '32rem', minHeight: '14rem' } },
} satisfies Meta<typeof SplitHandle>;

export default meta;
type Story = StoryObj;

function SplitPanes({ pane }: { pane: 'left' | 'right' }) {
  const [width, setWidth] = useState(200);
  const controlled = (
    <div
      className="flex h-40 shrink-0 items-center justify-center rounded-lg bg-muted text-caption text-muted-foreground"
      style={{ width }}
    >
      {width}px
    </div>
  );
  const filler = (
    <div className="flex h-40 flex-1 items-center justify-center rounded-lg bg-muted/50 text-caption text-muted-foreground">
      Fills the rest
    </div>
  );
  return (
    <div className="relative flex w-full gap-3">
      {pane === 'left' ? controlled : filler}
      <div className="relative w-2 shrink-0">
        <SplitHandle
          defaultWidth={200}
          label={`Resize ${pane} pane`}
          max={320}
          min={120}
          onWidthChange={setWidth}
          pane={pane}
          width={width}
        />
      </div>
      {pane === 'left' ? filler : controlled}
    </div>
  );
}

/** Drag, arrow keys, and a double-click reset all report a clamped width. */
export const LeftPane: Story = { render: () => <SplitPanes pane="left" /> };

/** `pane="right"` flips the drag direction so pulling left grows the pane. */
export const RightPane: Story = { render: () => <SplitPanes pane="right" /> };
