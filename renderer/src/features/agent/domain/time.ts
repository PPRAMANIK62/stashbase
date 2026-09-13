import type { AgentTranscriptBlock } from './session';

const DAY_MS = 86_400_000;

/** How a clock time or a calendar date is spelled for the reader.
 *
 *  The runtime's own locale is the default, and nothing in the app passes
 *  anything else. It is a parameter so a test can pin one: comparing a label
 *  against the same formatter that produced it proves only that `Intl` is
 *  deterministic, which is not what these functions are for. */
export type TimeLocale = Intl.LocalesArgument;

const RUNTIME_LOCALE: TimeLocale = [];

export function startOfLocalDay(value: number): Date {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** "Today", "Yesterday", or a calendar date; the year appears only when it
 *  differs from the current one. */
export function dayLabel(day: Date, today: Date, locale: TimeLocale = RUNTIME_LOCALE): string {
  if (day.getTime() === today.getTime()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day.getTime() === yesterday.getTime()) return 'Yesterday';
  return day.toLocaleDateString(
    locale,
    day.getFullYear() === today.getFullYear()
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' },
  );
}

/** Time of a prompt as a reader would say it: the clock time today, the
 *  weekday within the past week, otherwise the date. */
export function promptTimeLabel(
  at: number,
  now: number,
  locale: TimeLocale = RUNTIME_LOCALE,
): string {
  const moment = new Date(at);
  const time = moment.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const today = startOfLocalDay(now);
  const daysAgo = Math.round((today.getTime() - startOfLocalDay(at).getTime()) / DAY_MS);
  if (daysAgo === 0) return time;
  if (daysAgo > 0 && daysAgo < 7) {
    return `${moment.toLocaleDateString(locale, { weekday: 'short' })} ${time}`;
  }
  const date = moment.toLocaleDateString(
    locale,
    moment.getFullYear() === today.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  );
  return `${date}, ${time}`;
}

/** How long a turn took, as a reader would say it: seconds under a minute,
 *  then minutes and seconds, then hours and minutes. */
export function durationLabel(ms: number): string {
  const seconds = Math.round(Math.max(0, ms) / 1000);
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** How long ago something moved, at a glance: "now" within the minute,
 *  then minutes, hours, days, weeks, months, and years, each as one number
 *  and a letter so a column of them lines up. */
export function ageLabel(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/** When a reply settled, and how long its turn took when the prompt's own
 *  time is known too: "3:31 PM · 12s". */
export function replyTimeLabel(
  at: number,
  promptAt: number | undefined,
  now: number,
  locale: TimeLocale = RUNTIME_LOCALE,
): string {
  const settled = promptTimeLabel(at, now, locale);
  return promptAt === undefined ? settled : `${settled} · ${durationLabel(at - promptAt)}`;
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
