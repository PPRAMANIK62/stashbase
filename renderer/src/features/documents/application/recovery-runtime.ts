/**
 * One folder's crash-recovery decisions: the drafts a previous session left
 * behind, and the reader's restore or discard of each. Restore hands the text
 * to the document as unsaved edits and never writes the source; the journal
 * entry then belongs to the journalist, which clears it when the text lands.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import { sourceName } from '@/features/documents/domain/document';
import {
  recoveryCandidateKey,
  sortRecoveryCandidates,
  toRecoveryCandidate,
  type RecoveredDraft,
  type RecoveryCandidate,
} from '@/features/documents/domain/recovery';
import { isFeatureError, readFailure, type FailureView } from '@/shared/domain/feature-error';
import type { SourceReference } from '@/shared/domain/source-reference';
import { createScopeGuard } from '@/shared/runtime/scope-guard';

import type { DocumentRestoreOutcome } from './document-runtime';
import {
  recoveryDraftMessages,
  recoveryRestoreRefusal,
  RECOVERY_DRAFT_MESSAGES,
} from './failure-messages';
import type { RecoveryDraftPort } from './ports';

type RecoveryDecision = 'discard' | 'restore';

/** The folder's standing with the journal: listing, listed (possibly with
 *  nothing to show), disabled on this installation, or a listing that failed
 *  and can be refreshed. */
type RecoveryListingStatus = 'failed' | 'loading' | 'ready' | 'unavailable';

interface RecoveryDraftsState {
  readonly candidates: readonly RecoveryCandidate[];
  /** The last decision that failed, until the next decision or refresh. */
  readonly failure: FailureView | null;
  /** Decisions in flight, by candidate key. */
  readonly pending: Readonly<Record<string, RecoveryDecision>>;
  readonly status: RecoveryListingStatus;
}

export interface RecoveryRuntime {
  readonly folderPath: string;
  readonly store: StoreApi<RecoveryDraftsState>;
  discard(candidate: RecoveryCandidate): Promise<boolean>;
  discardAll(): Promise<boolean>;
  dispose(): void;
  refresh(): Promise<void>;
  restore(candidate: RecoveryCandidate): Promise<boolean>;
}

export interface RecoveryRuntimeOptions {
  api: RecoveryDraftPort;
  folderPath: string;
  /** Loads a draft into its document as unsaved text and answers how it went. */
  restoreInto(source: SourceReference, draft: RecoveredDraft): Promise<DocumentRestoreOutcome>;
}

export function createRecoveryRuntime({
  api,
  folderPath,
  restoreInto,
}: RecoveryRuntimeOptions): RecoveryRuntime {
  if (folderPath.trim().length === 0) throw new Error('Recovery folder path must not be empty.');
  const controller = new AbortController();
  const store = createStore<RecoveryDraftsState>(() => ({
    candidates: [],
    failure: null,
    pending: {},
    status: 'loading',
  }));
  let disposed = false;
  const guard = createScopeGuard<string>({
    disposed: () => disposed,
    sameScope: (captured, live) => captured === live,
    scope: () => folderPath,
  });

  const setPending = (key: string, decision: RecoveryDecision | null) => {
    store.setState((state) => {
      const pending = { ...state.pending };
      if (decision === null) delete pending[key];
      else pending[key] = decision;
      return { ...state, failure: decision === null ? state.failure : null, pending };
    });
  };

  const settle = (key: string, failure: FailureView | null) => {
    store.setState((state) => {
      const pending = { ...state.pending };
      delete pending[key];
      return {
        ...state,
        candidates:
          failure === null
            ? state.candidates.filter((candidate) => recoveryCandidateKey(candidate) !== key)
            : state.candidates,
        failure,
        pending,
      };
    });
  };

  const decide = async (
    candidate: RecoveryCandidate,
    decision: RecoveryDecision,
    act: () => Promise<FailureView | null>,
  ): Promise<boolean> => {
    if (disposed) return false;
    const key = recoveryCandidateKey(candidate);
    if (store.getState().pending[key]) return false;
    const captured = guard.capture();
    setPending(key, decision);
    let failure: FailureView | null;
    try {
      failure = await act();
    } catch (error) {
      // A draft that is already gone was handled elsewhere; it leaves the list.
      failure =
        isFeatureError<'not-found'>(error, 'RecoveryDraftError') && error.kind === 'not-found'
          ? null
          : readFailure<'disabled' | 'not-found' | 'too-large'>(
              error,
              recoveryDraftMessages(sourceName(candidate.source)),
              { owner: 'RecoveryDraftError' },
            );
    }
    if (controller.signal.aborted) return false;
    let settled = false;
    guard.accept(captured, () => {
      settle(key, failure);
      settled = failure === null;
    });
    return settled;
  };

  const runtime: RecoveryRuntime = {
    folderPath,
    store,
    discard(candidate) {
      return decide(candidate, 'discard', async () => {
        await api.discard(candidate.source, controller.signal);
        return null;
      });
    },
    async discardAll() {
      let all = true;
      for (const candidate of store.getState().candidates) {
        if (!(await runtime.discard(candidate))) all = false;
      }
      return all;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      guard.retireOperations();
      controller.abort();
    },
    async refresh() {
      if (disposed) return;
      const captured = guard.capture();
      store.setState((state) => ({ ...state, failure: null, status: 'loading' }));
      try {
        const listing = await api.list(folderPath, controller.signal);
        guard.accept(captured, () => {
          store.setState((state) =>
            listing.available
              ? {
                  ...state,
                  candidates: sortRecoveryCandidates(listing.drafts.map(toRecoveryCandidate)),
                  status: 'ready',
                }
              : { ...state, candidates: [], status: 'unavailable' },
          );
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        guard.accept(captured, () => {
          store.setState((state) => ({
            ...state,
            failure: readFailure<'disabled' | 'not-found' | 'too-large'>(
              error,
              RECOVERY_DRAFT_MESSAGES,
              { owner: 'RecoveryDraftError' },
            ),
            status: 'failed',
          }));
        });
      }
    },
    restore(candidate) {
      return decide(candidate, 'restore', async () => {
        const record = await api.read(candidate.source, controller.signal);
        const outcome = await restoreInto(candidate.source, {
          content: record.content,
          expectedVersion: record.expectedVersion,
        });
        if (outcome === 'refused') {
          return {
            message: recoveryRestoreRefusal(sourceName(candidate.source)),
            tone: 'capability',
          };
        }
        // The draft is now the document's own unsaved text, or matches the
        // disk already; either way the journal entry has nothing left to
        // protect until the journalist writes a newer one.
        if (outcome === 'unchanged') await api.discard(candidate.source, controller.signal);
        return null;
      });
    },
  };

  return runtime;
}
