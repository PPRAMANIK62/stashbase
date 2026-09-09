import {
  useId,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

/**
 * The one row grammar every Settings section is built from: a pane title,
 * titled groups, hairline lists, and rows of `lead · title and detail ·
 * trailing control`. Rows carry their own title, so a control inside one
 * never renders a label of its own. A row that picks one of several options
 * is a `ChoiceRow`: its radio sits in the leading slot and the whole row is
 * the option. Nothing here has a surface fill; the only tint is the one
 * pressable controls share.
 */

export function SettingsPane({
  children,
  lede,
  title,
}: {
  children: ReactNode;
  lede?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-body font-semibold text-foreground">{title}</h2>
        {lede && (
          <p className="mt-0.5 max-w-[62ch] text-caption leading-relaxed text-muted-foreground">
            {lede}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export function SettingsGroup({
  children,
  count,
  hint,
  title,
}: {
  children: ReactNode;
  /** A quiet tally beside the title, such as "1 of 3 installed". */
  count?: string;
  /** One sentence under the list that explains what the group's choice does. */
  hint?: ReactNode;
  title: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <h3 className="text-caption font-semibold text-foreground" id={titleId}>
        {title}
        {count && <span className="ml-1.5 font-normal text-muted-foreground">{count}</span>}
      </h3>
      {children}
      {hint && <p className="px-0.5 text-caption text-muted-foreground">{hint}</p>}
    </section>
  );
}

export function SettingsList({
  as: Component = 'div',
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'ul' }) {
  return (
    <Component
      className={cn('m-0 list-none overflow-hidden rounded-xl border border-border p-0', className)}
      {...props}
    />
  );
}

export interface SettingsRowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'div' | 'li';
  /** Content under the title and detail: a bar, an inline editor, a notice. */
  children?: ReactNode;
  detail?: ReactNode;
  detailTone?: 'muted' | 'error';
  /** Leading slot: a runtime icon, a status glyph, or a choice indicator. */
  lead?: ReactNode;
  title: ReactNode;
  titleTone?: 'default' | 'error';
  /** The checked option in a choice list reads one weight heavier. */
  titleWeight?: 'medium' | 'semibold';
  /** Trailing slot: the row's control or actions. */
  trail?: ReactNode;
}

export function SettingsRow({
  as: Component = 'div',
  children,
  className,
  detail,
  detailTone = 'muted',
  lead,
  title,
  titleTone = 'default',
  titleWeight = 'medium',
  trail,
  ...props
}: SettingsRowProps) {
  const tall = children !== undefined && children !== null && children !== false;
  return (
    <Component
      className={cn(
        'grid gap-x-3 border-t border-border px-3.5 py-2.5 first:border-t-0',
        lead ? 'grid-cols-[auto_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
        tall ? 'items-start' : 'items-center',
        className,
      )}
      {...props}
    >
      {lead && <div className={cn('flex shrink-0', tall && 'mt-0.5')}>{lead}</div>}
      <div className="min-w-0">
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body',
            titleWeight === 'semibold' ? 'font-semibold' : 'font-medium',
            titleTone === 'error' ? 'text-destructive' : 'text-foreground',
          )}
        >
          {title}
        </div>
        {detail && (
          <div
            className={cn(
              'mt-0.5 text-caption leading-snug',
              detailTone === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {detail}
          </div>
        )}
      </div>
      {trail !== undefined && trail !== null && (
        <div className={cn('flex shrink-0 items-center gap-1 justify-self-end', tall && 'mt-0.5')}>
          {trail}
        </div>
      )}
      {tall && (
        <div className={cn('mt-2.5', lead ? 'col-start-2 -col-end-1' : 'col-span-full')}>
          {children}
        </div>
      )}
    </Component>
  );
}

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
    row.focus();
    const nextValue = row.dataset.value;
    if (nextValue !== undefined && nextValue !== value) onValueChange(nextValue);
  };
  return (
    <div
      className={cn('m-0 list-none overflow-hidden rounded-xl border border-border p-0', className)}
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
  detailTone,
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
  detailTone?: 'muted' | 'error';
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
        'cursor-pointer transition-colors duration-80 outline-none hover:bg-hover',
        'focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] focus-visible:ring-inset',
        className,
      )}
      data-value={value}
      detail={detail}
      detailTone={detailTone}
      lead={<ChoiceIndicator checked={checked} />}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="radio"
      tabIndex={checked || firstTabStop ? 0 : -1}
      title={title ?? label}
      titleWeight={checked ? 'semibold' : 'medium'}
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
        'flex size-4 items-center justify-center rounded-full border-[1.5px] transition-colors duration-80',
        checked ? 'border-transparent' : 'border-border',
      )}
    >
      <span
        className={cn(
          'size-2 rounded-full bg-foreground transition-transform duration-80',
          checked ? 'scale-100' : 'scale-0',
        )}
      />
    </span>
  );
}

/** State as form: a dot and a word, never a colored sentence. */
export function StatusChip({
  children,
  tone = 'on',
}: {
  children: ReactNode;
  tone?: 'on' | 'muted' | 'warn';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'warn'
          ? 'text-decision'
          : tone === 'on'
            ? 'text-foreground'
            : 'text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          tone === 'warn' ? 'bg-decision' : tone === 'on' ? 'bg-working' : 'bg-muted-foreground',
        )}
      />
      {children}
    </span>
  );
}

export function ProgressBar({
  className,
  live = false,
  value,
}: {
  className?: string;
  /** In-progress work takes the focus accent; a standing measure stays neutral. */
  live?: boolean;
  value: number;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-active', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300 ease-out',
          live ? 'bg-[color:var(--focus-ring,#6B97FF)]' : 'bg-foreground/70',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** A quiet disclosure for content most people never open, such as
 *  development-only controls or advanced connection details. */
export function Disclosure({
  badge,
  children,
  summary,
}: {
  badge?: ReactNode;
  children: ReactNode;
  summary: string;
}) {
  return (
    <details className="group/disclosure">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-0.5 py-1.5 text-caption font-semibold text-muted-foreground transition-colors duration-80 hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="size-1.5 -rotate-45 border-r-[1.5px] border-b-[1.5px] border-current transition-transform duration-80 group-open/disclosure:rotate-45"
        />
        {summary}
        {badge}
      </summary>
      <div className="px-0.5 pt-1 pb-2">{children}</div>
    </details>
  );
}
