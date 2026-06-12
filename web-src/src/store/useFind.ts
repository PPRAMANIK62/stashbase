import { useCallback, useRef, type RefObject } from 'react';
import type { Action, State } from './state';

/** Per-view find driver. Whichever view is currently rendered (CM
 *  editor, MD preview iframe, HTML preview iframe) registers one of
 *  these on mount so the global FindBar can drive search without
 *  knowing which surface is underneath. All methods may return a
 *  Promise — the HTML preview path is async because it round-trips
 *  through postMessage to the sandboxed iframe. */
export interface MatchInfo { current: number; total: number; }
export interface FindOptions { wholeWord: boolean; caseSensitive: boolean; }
export interface FindController {
  setQuery: (query: string, opts: FindOptions) => MatchInfo | Promise<MatchInfo>;
  next: () => MatchInfo | Promise<MatchInfo>;
  prev: () => MatchInfo | Promise<MatchInfo>;
  /** Tear down highlights / decorations. Called when the bar closes
   *  or when this controller is replaced by a tab/mode switch. */
  close: () => void;
}

/**
 * Find-bar driver registry + the actions FindBar calls. Extracted from
 * AppProvider: owns the active-controller ref and keeps `state.find`
 * (reducer-owned) in sync with whatever the live view reports.
 */
export function useFind(
  dispatch: (a: Action) => void,
  stateRef: RefObject<State>,
) {
  // Active find driver — whichever view is currently visible (CM
  // editor / MD preview / HTML preview iframe) registers itself here
  // on mount, deregisters on unmount.
  const findCtlRef = useRef<FindController | null>(null);

  // Async wrapper: every controller may return either a sync MatchInfo
  // or a Promise (HTML preview is postMessage round-trip). Centralised
  // so the FindBar can call sync-looking actions.
  const applyMatchInfo = useCallback(async (p: MatchInfo | Promise<MatchInfo>): Promise<void> => {
    const info = await Promise.resolve(p);
    dispatch({ type: 'FIND_SET', patch: { current: info.current, total: info.total } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registerFindController = useCallback((c: FindController | null) => {
    // Replacing the controller (tab/mode switch while the bar is open):
    // tear down the outgoing one so its highlights don't outlive its
    // owning view, then prime the new one with the current query so a
    // file-switch (or a keyword-hit click that pre-armed the bar) ends
    // up showing matches immediately instead of waiting for the user
    // to re-type.
    const prev = findCtlRef.current;
    if (prev && prev !== c) prev.close();
    findCtlRef.current = c;
    if (c) {
      const { query, wholeWord, caseSensitive, open } = stateRef.current.find;
      if (open && query) {
        void applyMatchInfo(c.setQuery(query, { wholeWord, caseSensitive }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyMatchInfo]);

  const openFind = useCallback(() => {
    dispatch({ type: 'FIND_OPEN' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeFind = useCallback(() => {
    findCtlRef.current?.close();
    dispatch({ type: 'FIND_CLOSE' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFindQuery = useCallback((q: string) => {
    dispatch({ type: 'FIND_SET', patch: { query: q } });
    const ctl = findCtlRef.current;
    if (!ctl) {
      dispatch({ type: 'FIND_SET', patch: { current: 0, total: 0 } });
      return;
    }
    const { wholeWord, caseSensitive } = stateRef.current.find;
    void applyMatchInfo(ctl.setQuery(q, { wholeWord, caseSensitive }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyMatchInfo]);

  const toggleFindCaseSensitive = useCallback(() => {
    const next = !stateRef.current.find.caseSensitive;
    dispatch({ type: 'FIND_SET', patch: { caseSensitive: next } });
    const ctl = findCtlRef.current;
    if (!ctl) return;
    const { query, wholeWord } = stateRef.current.find;
    void applyMatchInfo(ctl.setQuery(query, { wholeWord, caseSensitive: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyMatchInfo]);

  const toggleFindWholeWord = useCallback(() => {
    const next = !stateRef.current.find.wholeWord;
    dispatch({ type: 'FIND_SET', patch: { wholeWord: next } });
    const ctl = findCtlRef.current;
    if (!ctl) return;
    const { query, caseSensitive } = stateRef.current.find;
    void applyMatchInfo(ctl.setQuery(query, { wholeWord: next, caseSensitive }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyMatchInfo]);

  const findNext = useCallback(() => {
    const ctl = findCtlRef.current;
    if (!ctl) return;
    void applyMatchInfo(ctl.next());
  }, [applyMatchInfo]);

  const findPrev = useCallback(() => {
    const ctl = findCtlRef.current;
    if (!ctl) return;
    void applyMatchInfo(ctl.prev());
  }, [applyMatchInfo]);

  return {
    registerFindController, openFind, closeFind, setFindQuery,
    toggleFindCaseSensitive, toggleFindWholeWord, findNext, findPrev,
  };
}
