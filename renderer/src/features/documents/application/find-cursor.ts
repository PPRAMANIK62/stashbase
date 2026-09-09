/**
 * The cursor half of Find, shared by every document surface that can enumerate
 * its own matches synchronously.
 *
 * This module owns the query, the options, the position in the ordered match
 * list, and the counter the Find bar reports. It re-enumerates before every
 * move, so an edit made while Find is open can never leave the cursor pointing
 * at a match that no longer exists. A surface contributes only how to find its
 * matches and how to show them.
 */
import type {
  DocumentFindController,
  FindMatchInfo,
  FindOptions,
} from '@/features/documents/application/navigation-runtime';

export interface FindMatchSurface<TMatch> {
  /** Every match for `query` in the surface's live content, in reading order. */
  collect(query: string, options: FindOptions): TMatch[];
  /** Shows the whole match set, distinguishing the match under the cursor. */
  present?(matches: readonly TMatch[], active: TMatch | null): void;
  /** Brings the match under the cursor into view and selects it. */
  reveal(match: TMatch): void;
}

export interface FindMatchCursor extends DocumentFindController {
  next(): FindMatchInfo;
  previous(): FindMatchInfo;
  /** Re-enumerates after the surface changed underneath an open query. */
  refresh(): void;
  restoreQuery(query: string, options: FindOptions): FindMatchInfo;
  setQuery(query: string, options: FindOptions): FindMatchInfo;
}

export function createFindMatchCursor<TMatch>(surface: FindMatchSurface<TMatch>): FindMatchCursor {
  let matches: TMatch[] = [];
  let cursor = -1;
  let options: FindOptions = { caseSensitive: false, wholeWord: false };
  let query = '';

  const report = (): FindMatchInfo => ({
    current: cursor < 0 ? 0 : cursor + 1,
    total: matches.length,
  });
  const show = (reveal: boolean): FindMatchInfo => {
    const active = matches[cursor] ?? null;
    surface.present?.(matches, active);
    if (reveal && active) surface.reveal(active);
    return report();
  };
  // `keepPosition` holds the reader where they were across a re-enumeration;
  // a fresh query always restarts at the first match.
  const recompute = (keepPosition: boolean, reveal: boolean): FindMatchInfo => {
    const previous = cursor;
    matches = query ? surface.collect(query, options) : [];
    cursor = matches.length === 0 ? -1 : keepPosition ? Math.min(previous, matches.length - 1) : 0;
    return show(reveal);
  };
  const step = (direction: 1 | -1): FindMatchInfo => {
    recompute(true, false);
    if (matches.length === 0) return report();
    cursor = (cursor + direction + matches.length) % matches.length;
    return show(true);
  };

  return {
    close() {
      cursor = -1;
      matches = [];
      query = '';
      surface.present?.(matches, null);
    },
    next: () => step(1),
    previous: () => step(-1),
    refresh() {
      if (!query) return;
      recompute(true, false);
    },
    restoreQuery(nextQuery, nextOptions) {
      query = nextQuery;
      options = nextOptions;
      return recompute(true, false);
    },
    setQuery(nextQuery, nextOptions) {
      query = nextQuery;
      options = nextOptions;
      return recompute(false, true);
    },
  };
}
