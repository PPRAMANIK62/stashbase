import { describe, expect, it } from 'vite-plus/test';

import {
  FOCUS_RING,
  FOCUS_RING_BORDER,
  FOCUS_RING_FALLBACK,
  FOCUS_RING_SEAM,
  FOCUS_RING_TINT,
  focusRing,
} from './focus-ring';

const spellings = {
  ring: FOCUS_RING,
  border: FOCUS_RING_BORDER,
  seam: FOCUS_RING_SEAM,
  tint: FOCUS_RING_TINT,
} as const;

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);

describe('focus indicator recipe', () => {
  it('draws every spelling from the one --focus-ring token', () => {
    for (const spelling of Object.values(spellings)) {
      expect(spelling).toContain('var(--focus-ring,');
    }
  });

  it('gives every spelling the same documented colour fallback', () => {
    // Every spelling reaches the colour the same way, and carries the one
    // utility that declares it — a spelling that referenced the fallback
    // without declaring it would draw nothing wherever --focus-ring is absent,
    // which is the only case the fallback exists for.
    for (const spelling of Object.values(spellings)) {
      expect(spelling).toContain('var(--focus-ring,var(--focus-ring-fallback))');
      expect(classesOf(spelling)).toContain(FOCUS_RING_FALLBACK);
    }
  });

  it('writes the literal colour exactly once', () => {
    // The literal is the single documented exception to the token rule. It
    // survives as a colour rather than drifting into a var reference, and it
    // survives in one place rather than four.
    expect(FOCUS_RING_FALLBACK).toMatch(/^\[--focus-ring-fallback:#[0-9a-fA-F]{3,8}\]$/);
    const occurrences = Object.values(spellings)
      .join(' ')
      .match(/#[0-9a-fA-F]{3,8}/g)
      ?.filter((hex, _index, all) => all.includes(hex));
    expect(new Set(occurrences).size).toBe(1);
  });

  it('writes whole class names so Tailwind can scan them', () => {
    // A class assembled by concatenation is never generated, so no spelling may
    // end mid-token or carry a placeholder.
    for (const spelling of Object.values(spellings)) {
      for (const className of classesOf(spelling)) {
        expect(className).not.toMatch(/[$`]/);
        expect(className.endsWith('-')).toBe(false);
      }
    }
  });

  it('composes the ring with the offsets a call site adds', () => {
    expect(focusRing()).toBe(FOCUS_RING);
    const composed = new Set(classesOf(focusRing('rounded-full ring-offset-2')));
    for (const className of classesOf(FOCUS_RING)) expect(composed.has(className)).toBe(true);
    expect(composed.has('rounded-full')).toBe(true);
    expect(composed.has('ring-offset-2')).toBe(true);
  });
});
