import type { ReactNode } from 'react';

import { CommandItem, CommandList } from '@/components/ui/command-menu';
import { useShape } from '@/lib/shape-context';
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

/**
 * The `@`/`/` suggestion popup.
 *
 * The list itself is the app's command list, so the listbox role, the active
 * row's highlight, hover tracking and scrolling the active row into view are
 * the same ones Quick Open and the chat history popover run. This panel owns
 * only what is particular to the composer: where the popup sits, that a row is
 * taken on `mousedown` rather than on click so the editor never loses the
 * caret, and the notice a skill query leaves behind when it matches nothing.
 *
 * Focus stays in the editor throughout; the composer points
 * `aria-activedescendant` at the row the caret is on.
 */
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
  const shape = useShape();
  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-full z-20 mb-2 border border-border bg-surface-3 p-1 shadow-surface-3',
        shape.container,
      )}
    >
      {rows.length > 0 && (
        <CommandList
          activeIndex={activeIndex}
          aria-label={label}
          className="max-h-64 p-0"
          id={id}
          onActiveIndexChange={onHover}
        >
          {rows.map((row, index) => (
            <CommandItem
              // A suggestion carries two lines, so the row grows to them
              // instead of holding the command list's single-line height.
              className="h-auto items-start gap-2 px-2 py-1.5"
              id={mentionOptionId(id, index)}
              key={row.key}
              // `mousedown`, not `click`: a click would blur the editor first,
              // and the insertion has nowhere to land without the caret.
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(index);
              }}
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
            </CommandItem>
          ))}
        </CommandList>
      )}
      {notice}
    </div>
  );
}
