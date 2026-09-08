import { describe, expect, it } from 'vite-plus/test';

import { dayLabel, promptTimeLabel, startOfLocalDay, transcriptDayBreaks } from './time';

const DAY = 86_400_000;
const now = new Date(2026, 8, 9, 15, 30).getTime();
const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

describe('promptTimeLabel', () => {
  it('shows only the clock time for today', () => {
    const at = now - 60_000;
    expect(promptTimeLabel(at, now)).toBe(clock(at));
  });

  it('adds the weekday inside the past week and the date beyond it', () => {
    const twoDaysAgo = now - 2 * DAY;
    expect(promptTimeLabel(twoDaysAgo, now)).toBe(
      `${new Date(twoDaysAgo).toLocaleDateString([], { weekday: 'short' })} ${clock(twoDaysAgo)}`,
    );
    const lastMonth = now - 40 * DAY;
    expect(promptTimeLabel(lastMonth, now)).toBe(
      `${new Date(lastMonth).toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${clock(lastMonth)}`,
    );
    const lastYear = now - 400 * DAY;
    expect(promptTimeLabel(lastYear, now)).toContain(String(new Date(lastYear).getFullYear()));
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, then falls back to the date', () => {
    const today = startOfLocalDay(now);
    expect(dayLabel(today, today)).toBe('Today');
    expect(dayLabel(startOfLocalDay(now - DAY), today)).toBe('Yesterday');
    expect(dayLabel(startOfLocalDay(now - 3 * DAY), today)).toBe(
      new Date(now - 3 * DAY).toLocaleDateString([], { day: 'numeric', month: 'long' }),
    );
  });
});

describe('transcriptDayBreaks', () => {
  it('marks prompts that open a new day, never the first one', () => {
    const breaks = transcriptDayBreaks([
      { at: now - 2 * DAY, id: 'u1', kind: 'user', text: 'a' },
      { id: 'a1', kind: 'assistant', text: 'b' },
      { at: now - 2 * DAY + 60_000, id: 'u2', kind: 'user', text: 'c' },
      { at: now, id: 'u3', kind: 'user', text: 'd' },
      { id: 'u4', kind: 'user', text: 'untimed' },
    ]);
    expect([...breaks]).toEqual(['u3']);
  });
});
