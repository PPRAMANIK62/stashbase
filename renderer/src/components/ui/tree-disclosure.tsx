import { Collapsible } from '@base-ui/react/collapsible';
import { useId, useState, type ReactNode } from 'react';

import { useIcon } from '@/lib/icon-context';

export function TreeDisclosure({ children, label }: { children: ReactNode; label: string }) {
  const [open, setOpen] = useState(true);
  const panelId = useId();
  const ChevronRight = useIcon('chevron-right');

  return (
    <Collapsible.Root onOpenChange={setOpen} open={open}>
      <Collapsible.Trigger
        render={
          <button
            aria-controls={panelId}
            className="flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-caption text-muted-foreground transition-colors outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
            data-tree-branch=""
            type="button"
          >
            <ChevronRight
              aria-hidden="true"
              className={
                open
                  ? 'size-3.5 rotate-90 transition-transform duration-80 motion-reduce:transition-none'
                  : 'size-3.5 transition-transform duration-80 motion-reduce:transition-none'
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
