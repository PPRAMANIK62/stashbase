/**
 * The document history's store and the three verbs over it. The tabs runtime
 * owns one per folder and decides when a visit is recorded; the back and
 * forward controls read the store and ask the tabs runtime to step, so the
 * cursor only moves once the document it names is actually in front of the
 * reader.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  createDocumentHistoryState,
  nextDocumentVisit,
  previousDocumentVisit,
  recordDocumentVisit,
  stepDocumentHistoryBack,
  stepDocumentHistoryForward,
  type DocumentHistoryState,
  type DocumentVisit,
} from '@/features/documents/domain/history';

export interface DocumentHistoryRuntime {
  readonly store: StoreApi<DocumentHistoryState>;
  /** The visit one step back, or null at the start. */
  previous(): DocumentVisit | null;
  /** The visit one step forward, or null at the end. */
  next(): DocumentVisit | null;
  record(visit: DocumentVisit): void;
  stepBack(): void;
  stepForward(): void;
}

export function createDocumentHistoryRuntime(): DocumentHistoryRuntime {
  const store = createStore<DocumentHistoryState>(createDocumentHistoryState);
  return {
    store,
    next: () => nextDocumentVisit(store.getState()),
    previous: () => previousDocumentVisit(store.getState()),
    record(visit) {
      store.setState((state) => recordDocumentVisit(state, visit));
    },
    stepBack() {
      store.setState(stepDocumentHistoryBack);
    },
    stepForward() {
      store.setState(stepDocumentHistoryForward);
    },
  };
}
