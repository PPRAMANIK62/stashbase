import { Collapsible } from '@base-ui/react/collapsible';
import { useId, useState, type ReactNode } from 'react';

import { Disclosure } from '@/components/ui/disclosure';
import { focusRing } from '@/lib/focus-ring';
import { useIcon } from '@/lib/icon-context';
import { useShape } from '@/lib/shape-context';

export function TreeDisclosure({ children, label }: { children: ReactNode; label: string }) {
  const [open, setOpen] = useState(true);
  const panelId = useId();
  const ChevronRight = useIcon('chevron-right');
  const shape = useShape();

  return (
    <Collapsible.Root onOpenChange={setOpen} open={open}>
      <Collapsible.Trigger
        render={
          <button
            aria-controls={panelId}
            className={focusRing(
              `flex h-7 w-full items-center gap-1.5 ${shape.item} px-2 text-left text-caption text-muted-foreground transition-colors outline-none hover:bg-hover hover:text-foreground`,
            )}
            data-tree-branch=""
            type="button"
          >
            <ChevronRight
              aria-hidden="true"
              // The resting stroke every other glyph in the column wears.
              strokeWidth={1.5}
              className={
                open
                  ? 'size-3.5 rotate-90 transition-transform duration-fast motion-reduce:transition-none'
                  : 'size-3.5 transition-transform duration-fast motion-reduce:transition-none'
              }
            />
            <span>{label}</span>
          </button>
        }
      />
      {/* The branch folds through the kit's measured region rather than Base
          UI's Panel, which shows and hides in one frame. The rule joining the
          panel to its trigger travels with the height, so the branch rolls up
          into the row it hangs from. */}
      <Disclosure className="ml-[15px] border-l border-border pl-1" id={panelId} open={open}>
        {children}
      </Disclosure>
    </Collapsible.Root>
  );
}
