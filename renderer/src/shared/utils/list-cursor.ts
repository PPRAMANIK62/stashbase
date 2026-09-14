export interface ListCursor {
  readonly activeIndex: number;
  readonly count: number;
  /** Rows a Page key jumps. A list that declares no page size does not answer
   *  the page keys at all, which is how a short list — or one whose rows are
   *  not a uniform page, like the folder tree — opts out of them without
   *  opting out of the rest of the policy. */
  readonly pageSize?: number | undefined;
}

/**
 * Where a keyboard key moves a list cursor, or null when the key does not move
 * it.
 *
 * One policy for every keyboard-driven list in the app — the search panes, the
 * file picker, the chat history popover — so a reader who learns the arrows in
 * one of them finds Home, End and the page keys in all of them. It lives in
 * the shared kernel rather than beside any one list, because a list that
 * cannot reach the policy writes its own, which is exactly how the two drift
 * apart. Callers own Enter, which opens.
 */
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
      return pageSize === undefined ? null : Math.min(activeIndex + pageSize, last);
    case 'PageUp':
      return pageSize === undefined ? null : Math.max(activeIndex - pageSize, 0);
    default:
      return null;
  }
}
