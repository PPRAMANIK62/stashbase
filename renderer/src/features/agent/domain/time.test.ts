import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  ageLabel,
  dayLabel,
  durationLabel,
  promptTimeLabel,
  replyTimeLabel,
  startOfLocalDay,
  transcriptDayBreaks,
} from './time';

const DAY = 86_400_000;
/** A pinned Wednesday afternoon, so every label below is a fixed string
 *  rather than whatever the machine's clock and locale would produce. */
const NOW = new Date(2026, 8, 9, 15, 30);
const now = NOW.getTime();
const EN = 'en-US';

/** ICU separates the meridiem with a narrow no-break space; the reader sees a
 *  space, and the test should not be about which one. */
const plain = (label: string) => label.replaceAll(' ', ' ');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('promptTimeLabel', () => {
  it('shows only the clock time for today', () => {
    expect(plain(promptTimeLabel(now - 60_000, now, EN))).toBe('3:29 PM');
  });

  it('adds the weekday inside the past week and the date beyond it', () => {
    expect(plain(promptTimeLabel(now - 2 * DAY, now, EN))).toBe('Mon 3:30 PM');
    expect(plain(promptTimeLabel(now - 40 * DAY, now, EN))).toBe('Jul 31, 3:30 PM');
    expect(plain(promptTimeLabel(now - 400 * DAY, now, EN))).toBe('Aug 5, 2025, 3:30 PM');
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, then falls back to the date', () => {
    const today = startOfLocalDay(now);
    expect(dayLabel(today, today, EN)).toBe('Today');
    expect(dayLabel(startOfLocalDay(now - DAY), today, EN)).toBe('Yesterday');
    expect(dayLabel(startOfLocalDay(now - 3 * DAY), today, EN)).toBe('September 6');
    expect(dayLabel(startOfLocalDay(now - 400 * DAY), today, EN)).toBe('August 5, 2025');
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

describe('durationLabel', () => {
  it('reads as seconds, then minutes and seconds, then hours and minutes', () => {
    expect(durationLabel(300)).toBe('<1s');
    expect(durationLabel(12_400)).toBe('12s');
    expect(durationLabel(125_000)).toBe('2m 5s');
    expect(durationLabel(3_720_000)).toBe('1h 2m');
    expect(durationLabel(-5)).toBe('<1s');
  });
});

describe('replyTimeLabel', () => {
  it('says when the reply settled, and how long the turn took when the prompt was timed', () => {
    expect(plain(replyTimeLabel(now, now - 12_000, now, EN))).toBe('3:30 PM · 12s');
    expect(plain(replyTimeLabel(now, undefined, now, EN))).toBe('3:30 PM');
    expect(plain(replyTimeLabel(now - DAY, now - DAY - 65_000, now, EN))).toBe(
      'Tue 3:30 PM · 1m 5s',
    );
  });
});

describe('ageLabel', () => {
  it('says how long ago in one number and a unit', () => {
    const clock = Date.UTC(2026, 8, 13, 12);
    const minute = 60_000;
    expect(ageLabel(clock - 20_000, clock)).toBe('now');
    expect(ageLabel(clock - 5 * minute, clock)).toBe('5m');
    expect(ageLabel(clock - 22 * 60 * minute, clock)).toBe('22h');
    expect(ageLabel(clock - 2 * 24 * 60 * minute, clock)).toBe('2d');
    expect(ageLabel(clock - 12 * 24 * 60 * minute, clock)).toBe('1w');
    expect(ageLabel(clock - 45 * 24 * 60 * minute, clock)).toBe('1mo');
    expect(ageLabel(clock - 400 * 24 * 60 * minute, clock)).toBe('1y');
    expect(ageLabel(clock + minute, clock)).toBe('now');
  });
});
