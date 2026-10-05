import { dayLabel, startOfLocalDay } from '@/features/agent/domain/time';

/** The break between prompts sent on different days. */
export function DayDivider({ at, now }: { at: number; now: number }) {
  const label = dayLabel(startOfLocalDay(at), startOfLocalDay(now));
  return (
    <div
      aria-label={label}
      className="flex items-center gap-3 text-ui-11 text-muted-foreground select-none not-first:mt-2"
      role="separator"
    >
      <span aria-hidden className="h-px flex-1 bg-border" />
      {label}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
