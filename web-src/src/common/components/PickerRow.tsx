import type { MouseEvent, ReactNode } from 'react';
import { emptyStateVariants } from '@/common/components/ui/empty-state';

/**
 * One result row in a topmost picker — Quick Open (files and commands),
 * Link to file, Editor History. All four spelled the same `<li>` by hand
 * around three shared class strings, and the markup is the part that has
 * to agree: `role="option"` with `aria-selected`, an `id` the listbox
 * points `aria-activedescendant` at, hover-to-activate, and a mousedown
 * that must `preventDefault()` so the query field never loses focus to the
 * row being picked. A class string could carry the padding but not any of
 * those, which is why this is a component.
 *
 * Selection paints from `aria-selected`, so the ARIA state and the visual
 * state cannot drift apart — a quiet neutral surface, never an accent wash.
 */
export function PickerRow({ id, selected, label, detail, onHover, onPick }: {
  id: string;
  selected: boolean;
  label: ReactNode;
  /** Muted right-hand annotation — a containing folder, a shortcut, a
   *  category. Omitted by pickers whose rows are a single label. */
  detail?: ReactNode;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      className="group flex cursor-default justify-between gap-5 rounded-md px-2.5 py-2 aria-selected:bg-active"
      onMouseMove={onHover}
      onMouseDown={(event: MouseEvent) => { event.preventDefault(); onPick(); }}
    >
      <span>{label}</span>
      {detail !== undefined && (
        <small className="overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">{detail}</small>
      )}
    </li>
  );
}

/** The picker's "no matches" row — the shared EmptyState row layout, kept
 *  inside the listbox as a disabled option so the list is never an empty
 *  `role="listbox"` with nothing to announce. */
export function PickerEmptyRow({ children }: { children: ReactNode }) {
  return (
    <li className={emptyStateVariants({ layout: 'row' })} role="option" aria-disabled="true">
      {children}
    </li>
  );
}
