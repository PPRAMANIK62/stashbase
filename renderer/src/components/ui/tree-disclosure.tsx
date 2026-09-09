import { Collapsible } from '@base-ui/react/collapsible';
import { useId, useState, type ReactNode } from 'react';

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
      <Collapsible.Panel className="ml-[15px] border-l border-border/70 pl-1" id={panelId}>
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
