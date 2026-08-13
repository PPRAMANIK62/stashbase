import { useEffect } from 'react';
import { api } from '../api';
import type { Action, State } from '../store/state';
import { useLatestRef } from './useLatestRef';

const MEMBERSHIP_POLL_MS = 4000;

/** Adopt the server's library membership: fetch the lightweight
 *  `/api/folder` payload and dispatch `RECENT_LOADED` from it — the one
 *  resync step behind every optimistic membership edit (favorite flips,
 *  removals, failed opens) and the background poll. `shouldAdopt` can
 *  veto the dispatch (the poll ignores unchanged lists). Rejects on
 *  fetch failure so each call site decides whether its optimistic state
 *  survives. */
export async function refreshLibraryMembership(
  dispatch: (a: Action) => void,
  shouldAdopt?: (recent: State['recent']) => boolean,
): Promise<void> {
  const j = await api.getFolder();
  const recent = j.recent ?? [];
  if (shouldAdopt && !shouldAdopt(recent)) return;
  dispatch({ type: 'RECENT_LOADED', recent, homeDir: j.homeDir });
}

/** Library membership can change without this window acting: an agent's
 *  create_project in another window, or an external MCP client. There is
 *  no server→renderer membership push, so poll the lightweight
 *  `/api/folder` while the library list is visible and adopt the list
 *  only when the member set/order actually changed (openedAt churn is
 *  ignored — recency labels refresh on the next explicit action). */
export function useLibraryMembership(
  enabled: boolean,
  recent: State['recent'],
  dispatch: (a: Action) => void,
): void {
  // Read through a ref: adopting a fresh list must not restart the
  // interval, so the current membership key stays out of the deps.
  const recentKeyRef = useLatestRef(recent.map((r) => r.path).join('\n'));
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const timer = setInterval(() => {
      void refreshLibraryMembership(
        dispatch,
        (fresh) => !cancelled && fresh.map((r) => r.path).join('\n') !== recentKeyRef.current,
      ).catch(() => { /* transient; next tick retries */ });
    }, MEMBERSHIP_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dispatch, enabled]);
}
