import { folderRefsEqual } from '../folderPath';

/** One library membership entry as the server reports it (recents order). */
export interface LibraryListEntry {
  path: string;
  openedAt: string;
  favorite?: boolean;
}

/** How many non-favorite folders the collapsed LIBRARY list shows. */
export const LIBRARY_LIST_RECENT_LIMIT = 5;

export interface LibraryListPlan {
  /** Rows to render, favorites (all of them) first; both groups keep the
   *  input's recents order. Never contains the active folder. */
  visible: LibraryListEntry[];
  /** How many rows the collapsed disclosure hides. Deliberately independent
   *  of `expanded` so the expanded list still knows it should offer a
   *  "Show fewer" control (it is 0 only when disclosure changes nothing). */
  hiddenCount: number;
  /** Total library membership — the "Show all N…" figure. Counts every
   *  member including hidden rows and the active folder, plus a just-opened
   *  active folder the membership refresh has not caught up with yet. */
  totalCount: number;
}

/**
 * Progressive-disclosure windowing for the sidebar's LIBRARY resource list.
 * The window's current folder lives in the active zone above the list, so
 * it is excluded from the rows here; all favorites stay visible; while
 * collapsed only the `LIBRARY_LIST_RECENT_LIMIT` most recent non-favorites
 * follow them. `expanded` reveals every remaining row.
 */
export function libraryListPlan(
  entries: readonly LibraryListEntry[],
  activeFolderPath: string,
  expanded: boolean,
): LibraryListPlan {
  const rows = entries.filter(
    (entry) => !activeFolderPath || !folderRefsEqual(entry.path, activeFolderPath),
  );
  const favorites = rows.filter((entry) => entry.favorite);
  const others = rows.filter((entry) => !entry.favorite);
  const activeIsMember = rows.length !== entries.length;
  return {
    visible: [...favorites, ...(expanded ? others : others.slice(0, LIBRARY_LIST_RECENT_LIMIT))],
    hiddenCount: Math.max(0, others.length - LIBRARY_LIST_RECENT_LIMIT),
    totalCount: entries.length + (activeFolderPath && !activeIsMember ? 1 : 0),
  };
}
