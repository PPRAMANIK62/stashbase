/**
 * Polling the host for revision proposals parked against the open folder.
 *
 * Deliberately not react-query. A cached result replayed into an effect would
 * reopen a review the reader has already resolved, and a background refetch
 * would drain into a callback that is no longer listening. The drain deletes
 * what it returns, so the call belongs exactly where its result is handled:
 * one interval this hook owns, one delivery per drain.
 */
import { useEffect, useRef } from 'react';

import type {
  DocumentRevisionsPort,
  DrainedRevisions,
} from '@/features/documents/application/ports';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

/** Matched to the folder status poll's busy cadence in
 *  `features/preparation/domain/readiness.ts`, which is 1_500 ms. A shade
 *  slower, because a parked proposal is work the reader is not yet waiting
 *  on and the drain is a write on the host. */
const DRAIN_INTERVAL_MS = 2_000;

export function useRevisionProposals(
  api: DocumentRevisionsPort,
  folderPath: string | null,
  onProposals: (drained: DrainedRevisions) => void,
  onFailure: (folderPath: string) => void,
): void {
  // The callback closes over runtimes that change every render. Reading it
  // through a ref keeps a new identity from restarting the interval, which
  // would drain far more often than the cadence above.
  const deliver = useRef(onProposals);
  deliver.current = onProposals;
  const report = useRef(onFailure);
  report.current = onFailure;
  const signalFor = useRequestSignals<'drain'>();

  useEffect(() => {
    if (folderPath === null) return;
    let draining = false;
    let stopped = false;

    const drain = async () => {
      if (draining || stopped) return;
      draining = true;
      const signal = signalFor('drain');
      try {
        const drained = await api.drain(folderPath, signal);
        if (stopped) {
          if (drained.proposals.length > 0 || drained.unresolved.length > 0)
            report.current(folderPath);
          return;
        }
        if (drained.proposals.length > 0 || drained.unresolved.length > 0) {
          deliver.current(drained);
        }
      } catch {
        // The host may have consumed a proposal before the response was lost.
        // We cannot name it, but we can tell the reader that delivery is uncertain.
        report.current(folderPath);
      } finally {
        draining = false;
      }
    };

    void drain();
    const timer = setInterval(() => void drain(), DRAIN_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      // Replacing the lane aborts a pending request. The replacement itself
      // remains inert until this effect starts another drain.
      signalFor('drain');
    };
  }, [api, folderPath, signalFor]);
}
