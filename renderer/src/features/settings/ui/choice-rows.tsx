/**
 * A radiogroup whose options are whole Settings rows: the transcription model
 * list is the case it exists for. It borrows the row grammar in `rows.tsx`
 * for the shape and adds only what a choice needs — the indicator in the
 * leading slot, roving focus across the group, and a trailing control that
 * keeps its own click.
 */

import { type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

import { focusRing } from '@/lib/focus-ring';
import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';

import { SettingsRow } from './rows';

const INTERACTIVE = 'a[href], button, input, select, textarea, [role="tab"], [role="button"]';

/** A radiogroup whose options are whole rows. Arrow keys move and select;
 *  the checked row is the tab stop, or the first row when nothing is. */
export function ChoiceList({
  children,
  className,
  onValueChange,
  value,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  onValueChange(value: string): void;
  value: string | null;
}) {
  const shape = useShape();
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const rows = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"][data-value]'),
    );
    const current = rows.indexOf(event.target as HTMLElement);
    if (current === -1) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length;
    const row = rows[next];
    if (!row) return;
    row.focus();
    const nextValue = row.dataset.value;
    if (nextValue !== undefined && nextValue !== value) onValueChange(nextValue);
  };
  return (
    <div
      className={cn(
        'm-0 list-none overflow-hidden border border-border p-0',
        shape.panel,
        className,
      )}
      data-has-selection={value !== null ? '' : undefined}
      onKeyDown={onKeyDown}
      role="radiogroup"
      tabIndex={-1}
      {...props}
    >
      {children}
    </div>
  );
}

export function ChoiceRow({
  checked,
  children,
  className,
  detail,
  firstTabStop = false,
  label,
  onSelect,
  title,
  trail,
  value,
}: {
  checked: boolean;
  children?: ReactNode;
  className?: string;
  detail?: ReactNode;
  /** With nothing checked, the first row keeps the group reachable by keyboard. */
  firstTabStop?: boolean;
  /** Accessible name of the option; the visible title may add a status chip. */
  label: string;
  onSelect(): void;
  title?: ReactNode;
  trail?: ReactNode;
  value: string;
}) {
  const onClick = (event: MouseEvent<HTMLElement>) => {
    const interactive = (event.target as HTMLElement).closest(INTERACTIVE);
    if (interactive && interactive !== event.currentTarget) return;
    onSelect();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onSelect();
    }
  };
  return (
    <SettingsRow
      aria-checked={checked}
      aria-label={label}
      className={cn(
        'cursor-pointer transition-colors duration-fast outline-none hover:bg-hover',
        focusRing('focus-visible:ring-inset'),
        className,
      )}
      data-value={value}
      detail={detail}
      lead={<ChoiceIndicator checked={checked} />}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="radio"
      tabIndex={checked || firstTabStop ? 0 : -1}
      title={title ?? label}
      trail={trail}
    >
      {children}
    </SettingsRow>
  );
}

function ChoiceIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-4 items-center justify-center rounded-full border-[1.5px] transition-colors duration-fast',
        checked ? 'border-transparent' : 'border-border',
      )}
    >
      <span
        className={cn(
          'size-2 rounded-full bg-foreground transition-transform duration-fast',
          checked ? 'scale-100' : 'scale-0',
        )}
      />
    </span>
  );
}
