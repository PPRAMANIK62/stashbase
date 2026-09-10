/** React keys derived from the items themselves.
 *
 *  `cn` is a class-name concern and this is a list-identity one; they shared a
 *  module only because `utils` is where a helper lands when nobody names it. */

/** Pairs each item with a React key derived from the item itself, adding an
 *  occurrence suffix only where that content repeats. Positional lists get
 *  stable identity without falling back to the array index, which remounts
 *  every row after the one that moved whenever the list shifts. */
export function keyedByContent<T>(
  items: readonly T[],
  identity: (item: T) => string,
): { key: string; item: T }[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = identity(item);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return { key: occurrence === 0 ? base : `${base}#${occurrence}`, item };
  });
}
