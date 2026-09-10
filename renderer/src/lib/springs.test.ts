import { describe, expect, it } from 'vite-plus/test';

import { exitFallbackMs, exitTween, spring, tween } from './springs';

// The token values themselves are free to move; what the rest of the renderer
// leans on is the shape of the ladder, so every assertion here is a relation
// between tokens rather than a restatement of a literal.
const entryLadder = [tween.snap, tween.fast, tween.base, tween.slow];
const exitLadder = [exitTween.fast, exitTween.base, exitTween.slow];
const tiers = [spring.fast, spring.moderate, spring.slow];

function ordering(values: readonly number[]): 'ascending' | 'non-descending' | 'unordered' {
  let strict = true;
  for (let index = 1; index < values.length; index++) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || current < previous) return 'unordered';
    if (current === previous) strict = false;
  }
  return strict ? 'ascending' : 'non-descending';
}

describe('motion tokens', () => {
  it('orders both ladders from shortest to longest', () => {
    expect(ordering(entryLadder.map((step) => step.duration))).toBe('ascending');
    expect(ordering(exitLadder.map((step) => step.duration))).toBe('ascending');
  });

  it('lets every tier leave faster than it arrived', () => {
    for (const tier of tiers) {
      expect(tier.exit.duration).toBeLessThan(tier.duration);
    }
  });

  it('builds each spring tier out of the published steps', () => {
    const entries = entryLadder.map((step) => step.duration);
    const exits = exitLadder.map((step) => step.duration);
    for (const tier of tiers) {
      expect(entries).toContain(tier.duration);
      expect(exits).toContain(tier.exit.duration);
    }
    expect(ordering(tiers.map((tier) => tier.duration))).toBe('ascending');
    // A longer tier may be allowed more overshoot, never less: the short tiers
    // are the ones that have to land exactly.
    expect(ordering(tiers.map((tier) => tier.bounce))).not.toBe('unordered');
  });

  it('derives the deferred-unmount fallback from the tier it guards', () => {
    const buffers = tiers.map(
      (tier) => exitFallbackMs(tier) - Math.round(tier.exit.duration * 1000),
    );
    // Every tier gets the same safety buffer on top of its own exit, so the
    // timers move with the tokens instead of being pinned independently.
    expect(new Set(buffers).size).toBe(1);
    expect(buffers.every((buffer) => buffer > 0)).toBe(true);
    expect(ordering(tiers.map((tier) => exitFallbackMs(tier)))).toBe('ascending');
    expect(tiers.every((tier) => Number.isInteger(exitFallbackMs(tier)))).toBe(true);
  });
});
