/** Kit geometry: one radius per role.
 * Rounded is the only supported geometry, so useShape is a plain lookup;
 * no variant state or provider is needed. CSS-only consumers read the
 * matching --shape-input-radius token from globals.css. */

interface ShapeClasses {
  item: string;
  bg: string;
  focusRing: string;
  mergedBg: string;
  container: string;
  /** A large surface the reader looks AT rather than through: the welcome
   *  cards, a Gallery tile, the pane card, a dialog, the composer. It is a
   *  separate role from `container` because radius does not scale with
   *  importance, it scales with the box: `container` also dresses a 40px
   *  viewer toolbar and a 28px segmented track, and a card-sized radius on
   *  those is clamped by the UA to half their height, which turns them into
   *  capsules rather than preserving the intended rounded rectangle. */
  card: string;
  input: string;
  /** A 16–24px box: a small badge, an inline mark. Below every other role
   *  because half of a 20px box is 10, and a role that crossed that would
   *  turn a badge into a circle. */
  mark: string;
  /** A small block — an inline chip, a path pill, a thumbnail, a tile the
   *  reader scans rather than reads. */
  chip: string;
  /** A framed section or list: a bordered group of rows, a notice, a preview
   *  frame. One step under `card`, so a panel inside a card reads as nested
   *  rather than as a second card. */
  panel: string;
  /** A full circle. `visual-style.md` reserves circles for semantics that need
   *  one — a status dot, or a terminal action such as the composer's send —
   *  so this role exists to make that choice explicit rather than to let a
   *  caller reach for `rounded-full` as a restyle. */
  circle: string;
  /** A drawn glyph rather than a box — the composer's stop square. Far below
   *  every other role (a 12px square with a control's radius reads as a
   *  rounded blob), but still written here rather than as the one arbitrary
   *  radius left in the kit. */
  glyph: string;
  // Numeric counterparts of `bg` / `mergedBg`, in px. Needed where individual
  // corners are animated (e.g. the selected-background merge/split animation),
  // which requires per-corner numeric border-radii rather than a class. They
  // are the same radius `--shape-input-radius` publishes to plain CSS, and
  // `tokens.test.ts` fails if the two ever stop being.
  bgRadius: number;
  mergedRadius: number;
}

/* The radii, drawn as continuous corners by the universal `corner-shape` rule
   in globals.css. Two numbers carry the whole scale: a container's 28 and an
   interaction's 12.

   The two work together and neither does it alone. The radius says how big the
   corner is; the superellipse says how much of it survives. A large radius on
   a plain arc reads deflated, because the arc leaves the edge early and cuts
   across; the same radius as a squircle stays full.

   The roles mirror the published scale one for one, because a radius belongs
   to a box size rather than to a rank: `mark` for a 16–24px badge, `chip` for
   a small block, `item`/`container`/`input` for a row or a piece of chrome,
   `panel` for a framed section, `card` for a large surface. `container` stays
   small on purpose — the same role dresses a 40px toolbar and a 28px
   segmented track, where a card's radius would be clamped to half the height
   and read as a capsule.

   12 is the ceiling for `button`, not a preference. One `Button` primitive
   draws every button in the application, and at the compact step its icon-only
   box is 28 square — a 14 radius there is a circle, and `visual-style.md`
   reserves circles and capsules for the things that mean one. 12 leaves the
   box a flat edge, so a short control still reads as a box. `input` and `item`
   sit on the same number because a popup row lines up with the trigger that
   opened it. */
export const shapeTokens: ShapeClasses = {
  item: 'rounded-lg',
  bg: 'rounded-lg',
  focusRing: 'rounded-[14px]',
  mergedBg: 'rounded-lg',
  container: 'rounded-lg',
  card: 'rounded-3xl',
  panel: 'rounded-2xl',
  chip: 'rounded-md',
  mark: 'rounded-sm',
  input: 'rounded-lg',
  circle: 'rounded-full',
  glyph: 'rounded-[3px]',
  bgRadius: 12,
  mergedRadius: 12,
};

/** The radii every primitive draws with. */
export function useShape(): ShapeClasses {
  return shapeTokens;
}
