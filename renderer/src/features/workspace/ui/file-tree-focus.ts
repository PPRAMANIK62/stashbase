import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { TreeRow } from '@/features/workspace/domain/tree';

/** The one row in the tree that is reachable with Tab: the row the user last
 *  moved to, else the selected one, else the first. */
export function tabStopPath(
  renderedRows: readonly TreeRow[],
  rovingPath: string | null,
  selectedPath: string | null,
): string | null {
  const at = (path: string | null) =>
    path === null ? undefined : renderedRows.find((row) => row.node.path === path);
  return (at(rovingPath) ?? at(selectedPath) ?? renderedRows[0])?.node.path ?? null;
}

export interface TreeRowFocus {
  /** Moves the tab stop to `path` and focuses its row once the listing shows
   *  it. A null path is a move with nowhere to go and does nothing. */
  focus(path: string | null): void;
  registerRow(path: string, element: HTMLButtonElement | null): void;
  /** Forgets the roving position, for a tree that has become another folder's. */
  reset(): void;
  rovingPath: string | null;
  setRovingPath(path: string): void;
}

/**
 * Roving tabindex and focus hand-off for the tree.
 *
 * A focus request is stamped rather than stored as a path, so asking again for
 * the row that already holds the tab stop still lands, and it is replayed
 * whenever the rendered rows change — which is how a row created by a mutation
 * takes focus only once the refreshed listing actually contains it.
 *
 * `renderedPathKey` is the identity of the rendered row order; it changes when
 * rows appear, leave, or move.
 */
export function useTreeRowFocus(renderedPathKey: string): TreeRowFocus {
  const [rovingPath, setRovingPath] = useState<string | null>(null);
  const [request, setRequest] = useState<{ path: string; revision: number } | null>(null);
  const revision = useRef(0);
  const handled = useRef(0);
  const elements = useRef(new Map<string, HTMLButtonElement>());

  useLayoutEffect(() => {
    if (!request || handled.current === request.revision) return;
    const element = elements.current.get(request.path);
    if (!element) return;
    handled.current = request.revision;
    element.focus();
  }, [renderedPathKey, request]);

  const focus = useCallback((path: string | null) => {
    if (path === null) return;
    revision.current += 1;
    setRovingPath(path);
    setRequest({ path, revision: revision.current });
  }, []);

  const registerRow = useCallback((path: string, element: HTMLButtonElement | null) => {
    if (element) elements.current.set(path, element);
    else elements.current.delete(path);
  }, []);

  const reset = useCallback(() => setRovingPath(null), []);

  return { focus, registerRow, reset, rovingPath, setRovingPath };
}
