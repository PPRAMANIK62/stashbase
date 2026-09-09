/** The kit's geometry: one radius per role, written once.
 *
 *  Decision 0015 fixes rounded corners as the only geometry this product
 *  ships, so there is no shape to choose and nothing to publish — the map
 *  below IS the shape. What used to be here (a one-member variant union, a
 *  provider holding it in state, a `setShape` nobody called, a forced-reflow
 *  `.transitioning` dance that cross-faded between the one option and itself,
 *  and a CSS custom property republishing a constant) was generality with no
 *  second case to serve.
 *
 *  `useShape()` survives unchanged so every call site reads the same way it
 *  did; it is a plain lookup now rather than a context read. The one value the
 *  old provider published to plain CSS — `--shape-input-radius`, which the
 *  focus-ring fallback and the Markdown viewer's stylesheet read — is a token
 *  in `globals.css` for the same reason. */

interface ShapeClasses {
  item: string;
  bg: string;
  focusRing: string;
  mergedBg: string;
  container: string;
  button: string;
  input: string;
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

export const shapeTokens: ShapeClasses = {
  item: 'rounded-lg',
  bg: 'rounded-lg',
  focusRing: 'rounded-[10px]',
  mergedBg: 'rounded-lg',
  container: 'rounded-xl',
  button: 'rounded-lg',
  input: 'rounded-lg',
  glyph: 'rounded-[3px]',
  bgRadius: 8,
  mergedRadius: 8,
};

/** The radii every primitive draws with. */
export function useShape(): ShapeClasses {
  return shapeTokens;
}
