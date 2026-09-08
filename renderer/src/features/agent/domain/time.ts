import type { AgentTranscriptBlock } from './session';

const DAY_MS = 86_400_000;

export function startOfLocalDay(value: number): Date {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** "Today", "Yesterday", or a calendar date; the year appears only when it
 *  differs from the current one. */
export function dayLabel(day: Date, today: Date): string {
  if (day.getTime() === today.getTime()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day.getTime() === yesterday.getTime()) return 'Yesterday';
  return day.toLocaleDateString(
    [],
    day.getFullYear() === today.getFullYear()
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' },
  );
}

/** Time of a prompt as a reader would say it: the clock time today, the
 *  weekday within the past week, otherwise the date. */
export function promptTimeLabel(at: number, now: number): string {
  const moment = new Date(at);
  const time = moment.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = startOfLocalDay(now);
  const daysAgo = Math.round((today.getTime() - startOfLocalDay(at).getTime()) / DAY_MS);
  if (daysAgo === 0) return time;
  if (daysAgo > 0 && daysAgo < 7) {
    return `${moment.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  }
  const date = moment.toLocaleDateString(
    [],
    moment.getFullYear() === today.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  );
  return `${date}, ${time}`;
}

/** Ids of the prompts that open a new local day, relative to the previous
 *  timed prompt. The first prompt never starts a break. */
export function transcriptDayBreaks(blocks: readonly AgentTranscriptBlock[]): Set<string> {
  const ids = new Set<string>();
  let previousDay: number | null = null;
  for (const block of blocks) {
    if (block.kind !== 'user' || block.at === undefined) continue;
    const day = startOfLocalDay(block.at).getTime();
    if (previousDay !== null && day !== previousDay) ids.add(block.id);
    previousDay = day;
  }
  return ids;
}
