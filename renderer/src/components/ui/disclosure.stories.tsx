import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from './button';
import { Disclosure } from './disclosure';

const meta = {
  title: 'Navigation/Disclosure',
  component: Disclosure,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '28rem', minHeight: '16rem' } },
} satisfies Meta<typeof Disclosure>;

export default meta;
type Story = StoryObj;

/** One disclosure, trigger and all: the primitive is only the box, so every
 *  story has to bring its own control — which is the point of the split. */
function Example({
  children,
  label,
  panelId,
  presence,
  startOpen = false,
}: {
  children: ReactNode;
  label: string;
  panelId: string;
  presence?: 'keep' | 'unmount' | undefined;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        aria-controls={panelId}
        aria-expanded={open}
        className="self-start"
        onClick={() => setOpen((value) => !value)}
        size="compact"
        variant="ghost"
      >
        <ChevronRight
          aria-hidden="true"
          className={
            open
              ? 'size-3.5 rotate-90 transition-transform duration-fast'
              : 'size-3.5 transition-transform duration-fast'
          }
          strokeWidth={1.5}
        />
        {label}
      </Button>
      <Disclosure className="flex flex-col gap-2" id={panelId} open={open} presence={presence}>
        {children}
      </Disclosure>
    </div>
  );
}

/** The region travels to its content's measured height; the trigger is the
 *  caller's, which is why the primitive is only the box beneath it. */
export const Region: Story = {
  render: () => (
    <Example label="Details" panelId="disclosure-story-region">
      <p className="text-body text-muted-foreground">
        A closed region is out of the tree entirely, so nothing inside it can be reached by tab and
        nothing costly stays mounted behind it.
      </p>
      <p className="text-body text-muted-foreground">
        A second paragraph, so the height the box travels to is its content&apos;s own.
      </p>
    </Example>
  ),
};

/** `presence="keep"` holds the content at height zero instead, for a region
 *  whose `aria-controls` target has to stay put. */
export const Kept: Story = {
  render: () => (
    <Example label="Notes" panelId="disclosure-story-kept" presence="keep" startOpen>
      <p className="text-body text-muted-foreground">
        Kept regions stay in the document, so a flex parent still spaces them while closed.
      </p>
    </Example>
  ),
};
