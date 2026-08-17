import type { Action, State } from '@/store/state/state';

export function shallowEqualIndexWarning(
  a: State['indexWarning'],
  b: State['indexWarning'],
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.message === b.message && a.at === b.at;
}

export function shallowEqualPreparationFailures(
  a: State['preparationFailures'],
  b: State['preparationFailures'],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((f, i) =>
    f.path === b[i].path
      && f.attempts === b[i].attempts
      && f.lastError === b[i].lastError
      && f.status === b[i].status,
  );
}

export function shallowEqualConversionProgress(
  a: State['conversionProgress'],
  b: State['conversionProgress'],
): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((key) => {
    const av = a[key];
    const bv = b[key];
    if (!bv || av.phase !== bv.phase) return false;
    if (av.phase === 'extracting' && bv.phase === 'extracting') {
      return av.currentPage === bv.currentPage
        && av.completedUnits === bv.completedUnits
        && av.totalUnits === bv.totalUnits;
    }
    if (
      (av.phase === 'queued' || av.phase === 'yielded')
      && bv.phase === av.phase
    ) {
      return av.lane === bv.lane && av.tasksAhead === bv.tasksAhead;
    }
    return true;
  });
}

/** The index poll re-reads this object every 1.5s while indexing. Without
 *  an equality guard its identity changes on every tick, which re-renders
 *  every `useWorkspace()` consumer even when the reported state is
 *  unchanged. */
export function shallowEqualSemanticIndexing(
  a: State['semanticIndexing'],
  b: State['semanticIndexing'],
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.state === b.state
    && a.sourceCount === b.sourceCount
    && a.estimatedBytes === b.estimatedBytes;
}

export function equalNameSets(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const name of a) if (!b.has(name)) return false;
  return true;
}

/**
 * Which of the two semantic-indexing actions the poll actually needs to
 * dispatch. Both land in the workspace slice and the poll runs every
 * `POLL_PENDING_MS` while indexing, so dispatching unconditionally
 * re-renders all ~37 `useWorkspace()` consumers on every tick — the poll
 * rebuilds `pendingSemanticNames` as a fresh `Set`, so its identity alone
 * never indicates a real change.
 *
 * Pure and separate from the hook so the guard is testable: a closure-local
 * `if` can be deleted without any test noticing.
 */
export function planSemanticPollDispatches(
  prev: Pick<State, 'pendingSemanticNames' | 'semanticIndexing'>,
  incoming: { pending: ReadonlySet<string>; semanticIndexing: State['semanticIndexing'] },
): Action[] {
  const actions: Action[] = [];
  if (!equalNameSets(prev.pendingSemanticNames, incoming.pending)) {
    actions.push({ type: 'PENDING_SEMANTIC_NAMES', names: new Set(incoming.pending) });
  }
  if (!shallowEqualSemanticIndexing(prev.semanticIndexing, incoming.semanticIndexing)) {
    actions.push({ type: 'SEMANTIC_INDEXING_STATE', state: incoming.semanticIndexing });
  }
  return actions;
}

export function shallowEqualNumberRecord(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  return ak.length === bk.length && ak.every((key) => a[key] === b[key]);
}

export function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function keywordFindCaseSensitive(query: string, caseStrict: boolean): boolean {
  return caseStrict || query !== query.toLowerCase();
}

/** True when the tab holds the ACTIVE folder's file `name`. Out-of-folder
 *  tabs (`file.folder` set) are a different document even under the same
 *  rel name, so they never match. */
export function isFolderFileTab(t: { file: State['tabs'][number]['file'] }, name: string): boolean {
  return t.file?.name === name && !t.file.folder;
}
