import { clamp } from '@/shared/utils/clamp';

/** One rung of the eight-step ladder; the tables below cover every rung, so a
 *  lookup by a clamped level never comes back undefined. */
type SurfaceLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const SURFACE_BG: Record<SurfaceLevel, string> = {
  1: 'bg-surface-1',
  2: 'bg-surface-2',
  3: 'bg-surface-3',
  4: 'bg-surface-4',
  5: 'bg-surface-5',
  6: 'bg-surface-6',
  7: 'bg-surface-7',
  8: 'bg-surface-8',
};

const SURFACE_SHADOW: Record<SurfaceLevel, string> = {
  1: 'shadow-surface-1',
  2: 'shadow-surface-2',
  3: 'shadow-surface-3',
  4: 'shadow-surface-4',
  5: 'shadow-surface-5',
  6: 'shadow-surface-6',
  7: 'shadow-surface-7',
  8: 'shadow-surface-8',
};

// Round after clamping so a fractional level can't index out of the lookup
// tables (which would render "undefined undefined").
function ladderStep(level: number): SurfaceLevel {
  return Math.round(clamp(level, 1, 8)) as SurfaceLevel;
}

/** A level's tint without its shadow: the lift for a selection pill that
 *  rides inside a muted track (the Settings preset picker). The track already
 *  draws the edge there, and the light ladder's hairline ring would outline a
 *  white pill as a stroke rather than read as depth, which is what made the
 *  two themes disagree about what the pill was. */
export function surfaceBackground(level: number): string {
  return SURFACE_BG[ladderStep(level)];
}

export function surfaceClasses(bgLevel: number, shadowLevel: number = bgLevel): string {
  return `${surfaceBackground(bgLevel)} ${SURFACE_SHADOW[ladderStep(shadowLevel)]}`;
}
