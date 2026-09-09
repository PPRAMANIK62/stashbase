import { cn } from '@/lib/utils';

/**
 * The one focus indicator recipe.
 *
 * `--focus-ring` is declared in globals.css, so the literal fallback is not
 * needed to render — it is here so a primitive copied out of this library
 * still draws a ring in a project that has not defined the token yet. That
 * fallback is the single documented exception to the "no raw hex outside the
 * token layer" rule.
 *
 * It is written once. The four spellings below used to inline the hex into
 * four separate arbitrary values, which is four places for the exception to
 * drift and four places for a typo to hide behind a ring that still draws.
 * Instead one utility declares `--focus-ring-fallback` on the element that
 * draws the indicator, and every spelling reaches the colour through
 * `var(--focus-ring, var(--focus-ring-fallback))`. Custom properties inherit,
 * which is how the `::after` seam reads it too. `lib/tokens.test.ts` holds the
 * literal equal to globals.css's `--focus-ring`.
 *
 * The class names themselves are still written out in full, because Tailwind
 * scans source for whole class names — one assembled by concatenation is never
 * generated. What is shared here is the colour, not the spelling.
 */
export const FOCUS_RING_FALLBACK = '[--focus-ring-fallback:#6B97FF]';

export const FOCUS_RING = `${FOCUS_RING_FALLBACK} focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,var(--focus-ring-fallback))]`;

/** Compose the ring with the offsets, radius or layout a call site adds. */
export function focusRing(extra?: string): string {
  return cn(FOCUS_RING, extra);
}

/**
 * Colour-only spellings, for the three indicators that are not a `ring-*`.
 *
 * A menu row cannot ring itself — its background is a shared overlay that
 * glides between rows — so the ring is a separately positioned border box
 * (`FOCUS_RING_BORDER`). An input group rings the whole container and owns
 * the width itself, toggling only the colour (`FOCUS_RING_TINT`). A split
 * handle has no box at all: it tints the hairline it draws on the seam
 * (`FOCUS_RING_SEAM`).
 */
export const FOCUS_RING_BORDER = `${FOCUS_RING_FALLBACK} border-[color:var(--focus-ring,var(--focus-ring-fallback))]`;
export const FOCUS_RING_TINT = `${FOCUS_RING_FALLBACK} ring-[color:var(--focus-ring,var(--focus-ring-fallback))]`;
export const FOCUS_RING_SEAM = `${FOCUS_RING_FALLBACK} focus-visible:after:bg-[color:var(--focus-ring,var(--focus-ring-fallback))]`;
