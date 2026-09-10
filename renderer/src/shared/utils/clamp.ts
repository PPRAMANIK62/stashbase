/** Confines `value` to `[min, max]`. The floor wins an inverted range, so a
 *  layout measured while its container is collapsed still reports `min`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
