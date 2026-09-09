export interface ListCursor {
  readonly activeIndex: number;
  readonly count: number;
  /** Rows a Page key jumps. */
  readonly pageSize: number;
}

/** Where a keyboard key moves a result cursor, or null when the key does not
 *  move it. One policy for every result list, so the search panes and the
 *  file picker cannot drift apart. Callers own Enter, which opens. */
export function listNavigationTarget(key: string, cursor: ListCursor): number | null {
  const { activeIndex, count, pageSize } = cursor;
  const last = count - 1;
  switch (key) {
    case 'ArrowDown':
      return Math.min(activeIndex + 1, last);
    case 'ArrowUp':
      return Math.max(activeIndex - 1, 0);
    case 'End':
      return last;
    case 'Home':
      return 0;
    case 'PageDown':
      return Math.min(activeIndex + pageSize, last);
    case 'PageUp':
      return Math.max(activeIndex - pageSize, 0);
    default:
      return null;
  }
}
