import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function mentionOptionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

/** One suggestion row, whichever list it came from: a `@` file or folder, or
 *  a `/` skill. Same grammar for both — icon, primary line, secondary line. */
export interface MentionRow {
  key: string;
  icon: ReactNode;
  primary: string;
  secondary?: string | undefined;
}

/** What the editor needs to hand the listbox its keyboard: the arrow keys,
 *  Enter and Tab to accept, Escape to dismiss. Declared beside the listbox so
 *  the editor that raises the keys and the panel that answers them agree on
 *  one contract. */
export interface MentionListboxBinding {
  open: boolean;
  controls?: string | undefined;
  activeOptionId?: string | undefined;
  onNavigate(direction: 1 | -1): void;
  onAccept(): boolean;
  onDismiss(): void;
}

/** The `@`/`/` suggestion popup. Focus stays in the editor; the composer
 *  points `aria-activedescendant` at the row the caret is on. A skill query
 *  keeps the popup open with no rows, so `notice` can say why. */
export function MentionListbox({
  activeIndex,
  id,
  label,
  notice,
  onHover,
  onPick,
  rows,
}: {
  activeIndex: number;
  id: string;
  label: string;
  notice?: ReactNode;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  rows: MentionRow[];
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);
  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-xl border border-border bg-surface-3 p-1 shadow-surface-3">
      {rows.length > 0 && (
        <div
          aria-label={label}
          className="max-h-64 overflow-y-auto"
          id={id}
          ref={listRef}
          role="listbox"
        >
          {rows.map((row, index) => {
            const selected = index === activeIndex;
            return (
              <div
                aria-selected={selected}
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-body text-foreground',
                  selected ? 'bg-hover' : 'hover:bg-hover',
                )}
                id={mentionOptionId(id, index)}
                key={row.key}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onPick(index);
                }}
                onMouseEnter={() => onHover(index)}
                role="option"
                tabIndex={-1}
              >
                {row.icon}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{row.primary}</span>
                  {row.secondary && (
                    <span className="truncate text-caption text-muted-foreground">
                      {row.secondary}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {notice}
    </div>
  );
}
