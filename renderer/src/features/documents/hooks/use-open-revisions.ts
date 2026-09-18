import { useEffect, useMemo, useState } from 'react';

import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-contract';

export interface OpenRevision {
  /** The parked proposal this review came from. */
  readonly id: string;
  /** Changes still to decide on this document. */
  readonly pending: number;
  acceptAll(): void;
  rejectAll(): void;
}

/** One open document's review as this hook watches it. The tab id is what
 *  reaches the runtime's controls; the path is what a reader outside the
 *  feature knows the document by. */
interface RevisionSnapshot {
  id: string;
  pending: number;
  path: string;
  tabId: string;
}

const NO_REVISIONS: ReadonlyMap<string, OpenRevision> = new Map();

function sameSnapshots(
  left: readonly RevisionSnapshot[],
  right: readonly RevisionSnapshot[],
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        entry.tabId === other.tabId &&
        entry.id === other.id &&
        entry.path === other.path &&
        entry.pending === other.pending
      );
    })
  );
}

/**
 * The reviews open across this folder's documents, keyed by the document's
 * folder-relative path.
 *
 * The diff plugin is the only thing that knows a count, so this reports one
 * rather than computing one. Rebuilt only when a count moves, so a surface
 * reading it re-renders exactly when the number it shows changes.
 */
export function useOpenRevisions(
  runtime: DocumentTabsRuntime | null,
): ReadonlyMap<string, OpenRevision> {
  const [open, setOpen] = useState<readonly RevisionSnapshot[]>([]);

  useEffect(() => {
    if (!runtime) {
      setOpen((current) => (current.length === 0 ? current : []));
      return;
    }
    let releases: Array<() => void> = [];
    const reviewing = () =>
      runtime.store.getState().tabs.flatMap((tab) => {
        const revision = runtime.getDocument(tab.id)?.store.getState().revision;
        return revision?.kind === 'reviewing'
          ? [
              {
                id: revision.review.id,
                pending: revision.pending,
                path: tab.source.path,
                tabId: tab.id,
              },
            ]
          : [];
      });
    const apply = () =>
      setOpen((current) => {
        const next = reviewing();
        return sameSnapshots(current, next) ? current : next;
      });
    // The open set and each open document move independently, so a tab
    // opening or closing rebinds the per-document subscriptions beneath it.
    const rebind = () => {
      for (const release of releases) release();
      releases = runtime.store
        .getState()
        .tabs.flatMap((tab) => runtime.getDocument(tab.id)?.store.subscribe(apply) ?? []);
      apply();
    };
    rebind();
    const releaseTabs = runtime.subscribe(rebind);
    return () => {
      releaseTabs();
      for (const release of releases) release();
    };
  }, [runtime]);

  // The snapshot only moves when a count does, so the map a reader holds is
  // the same object until the number it shows changes.
  return useMemo(() => {
    if (!runtime || open.length === 0) return NO_REVISIONS;
    return new Map(
      open.map((entry) => [
        entry.path,
        {
          id: entry.id,
          pending: entry.pending,
          acceptAll: () => runtime.getDocument(entry.tabId)?.revisionControls()?.acceptAll(),
          rejectAll: () => runtime.getDocument(entry.tabId)?.revisionControls()?.rejectAll(),
        },
      ]),
    );
  }, [open, runtime]);
}
