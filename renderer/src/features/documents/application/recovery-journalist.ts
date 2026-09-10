/**
 * Watches the open documents and keeps the recovery journal a little behind
 * the reader's unsaved text. A snapshot goes out off the interaction path,
 * a short pause after the last change; a save or an explicit reload clears
 * the entry. Nothing here blocks typing, saving, or closing, and a journal
 * that fails only records that it did: it is protection, never a save.
 */
import { isDocumentDirty, type DocumentState } from '@/features/documents/domain/document';
import { isFeatureError } from '@/shared/domain/feature-error';

import type { DocumentRuntime } from './document-runtime';
import { documentFailure, RECOVERY_DRAFT_MESSAGES } from './failure-messages';
import type { RecoveryDraftPort } from './ports';
import type { DocumentTabsRuntime } from './tabs-runtime';

/** How long after the last keystroke a snapshot is written. */
export const RECOVERY_JOURNAL_DELAY_MS = 1_500;
/** The longest a continuously edited document goes without a snapshot. */
export const RECOVERY_JOURNAL_MAX_DELAY_MS = 5_000;

/** Where one document stands with the journal. `clean` has nothing pending;
 *  `pending` has unsaved text waiting for the pause; `writing` has a snapshot
 *  in flight; `journaled` matches what the journal holds; `discarding` is
 *  clearing an entry after the text became clean. */
type JournaledDocumentPhase = 'clean' | 'discarding' | 'journaled' | 'pending' | 'writing';

interface JournaledDocumentState {
  readonly failures: number;
  readonly phase: JournaledDocumentPhase;
}

interface RecoveryJournalistState {
  readonly documents: Readonly<Record<string, JournaledDocumentState>>;
  /** The last refusal as a reader would be told it, so a report or a future
   *  surface never shows a transport's own diagnostic. */
  readonly lastFailure: string | null;
  /** True once the journal said it is disabled on this installation; no
   *  further call is made for the life of this journalist. */
  readonly suspended: boolean;
}

export interface RecoveryJournalist {
  dispose(): void;
  state(): RecoveryJournalistState;
}

export interface RecoveryJournalistOptions {
  api: RecoveryDraftPort;
  delayMs?: number;
  maxDelayMs?: number;
  now?: () => number;
  tabs: DocumentTabsRuntime;
}

/** The text a snapshot was about: enough to tell whether the document has
 *  moved on since. */
interface SnapshotMark {
  revision: number;
  version: string;
}

interface Tracker {
  /** The last snapshot a write was started for, landed or not. A failed
   *  write is not retried for the same text; the next change retries. */
  attempted: SnapshotMark | null;
  failures: number;
  /** When the current run of unsaved changes began, for the max delay. */
  firstPendingAt: number | null;
  inFlight: Promise<void> | null;
  phase: JournaledDocumentPhase;
  /** The document moved while a call was in flight; look again after it. */
  reobserve: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  /** Whether the document has held unsaved text this session, so a return
   *  to clean clears an entry even when no snapshot was written yet. */
  touched: boolean;
  unsubscribe: () => void;
  /** The snapshot the journal holds, so unchanged text is not written twice. */
  written: SnapshotMark | null;
}

function sameMark(mark: SnapshotMark | null, revision: number, version: string): boolean {
  return mark !== null && mark.revision === revision && mark.version === version;
}

function clearTimer(tracker: Tracker): void {
  if (tracker.timer !== null) clearTimeout(tracker.timer);
  tracker.timer = null;
}

export function createRecoveryJournalist({
  api,
  delayMs = RECOVERY_JOURNAL_DELAY_MS,
  maxDelayMs = RECOVERY_JOURNAL_MAX_DELAY_MS,
  now = Date.now,
  tabs,
}: RecoveryJournalistOptions): RecoveryJournalist {
  const controller = new AbortController();
  const trackers = new Map<string, Tracker>();
  let lastFailure: string | null = null;
  let suspended = false;
  let disposed = false;

  const fail = (tracker: Tracker, error: unknown) => {
    if (controller.signal.aborted) return;
    tracker.failures += 1;
    lastFailure = documentFailure(error, 'RecoveryDraftError', RECOVERY_DRAFT_MESSAGES).message;
    if (isFeatureError<'disabled'>(error, 'RecoveryDraftError') && error.kind === 'disabled') {
      suspended = true;
    }
  };

  const settle = (document: DocumentRuntime, tracker: Tracker, call: Promise<void>) => {
    tracker.inFlight = call.finally(() => {
      tracker.inFlight = null;
      if (disposed) return;
      const changed = tracker.reobserve;
      tracker.reobserve = false;
      observe(document, tracker, changed);
    });
  };

  const write = (document: DocumentRuntime, tracker: Tracker) => {
    clearTimer(tracker);
    const editor = document.store.getState().editor;
    if (!editor || !isDocumentDirty(editor) || suspended) return;
    const mark = { revision: editor.revision, version: editor.version };
    tracker.attempted = mark;
    tracker.phase = 'writing';
    tracker.firstPendingAt = null;
    settle(
      document,
      tracker,
      api
        .write(
          { content: editor.value, expectedVersion: editor.version, source: document.scope.source },
          controller.signal,
        )
        .then(
          () => {
            tracker.written = mark;
            tracker.phase = 'journaled';
          },
          (error: unknown) => {
            fail(tracker, error);
            tracker.phase = 'pending';
          },
        ),
    );
  };

  const discard = (document: DocumentRuntime, tracker: Tracker) => {
    clearTimer(tracker);
    tracker.touched = false;
    tracker.written = null;
    tracker.attempted = null;
    tracker.firstPendingAt = null;
    if (suspended) {
      tracker.phase = 'clean';
      return;
    }
    tracker.phase = 'discarding';
    settle(
      document,
      tracker,
      api.discard(document.scope.source, controller.signal).then(
        () => {
          tracker.phase = 'clean';
        },
        (error: unknown) => {
          fail(tracker, error);
          tracker.phase = 'clean';
        },
      ),
    );
  };

  /** Reads where the document stands and moves the tracker to match. */
  const observe = (document: DocumentRuntime, tracker: Tracker, changed: boolean) => {
    const state: DocumentState = document.store.getState();
    const editor = state.editor;
    if (!editor || state.lifecycle === 'disposed') return;
    if (tracker.inFlight) {
      if (changed) tracker.reobserve = true;
      return;
    }
    if (!isDocumentDirty(editor)) {
      if (tracker.touched) discard(document, tracker);
      return;
    }
    tracker.touched = true;
    if (sameMark(tracker.written, editor.revision, editor.version)) {
      tracker.phase = 'journaled';
      return;
    }
    if (sameMark(tracker.attempted, editor.revision, editor.version)) return;
    tracker.phase = 'pending';
    const at = now();
    tracker.firstPendingAt ??= at;
    const remaining = Math.min(delayMs, tracker.firstPendingAt + maxDelayMs - at);
    clearTimer(tracker);
    if (remaining <= 0) {
      write(document, tracker);
      return;
    }
    tracker.timer = setTimeout(() => {
      tracker.timer = null;
      write(document, tracker);
    }, remaining);
  };

  const track = (tabId: string, document: DocumentRuntime) => {
    const tracker: Tracker = {
      attempted: null,
      failures: 0,
      firstPendingAt: null,
      inFlight: null,
      phase: 'clean',
      reobserve: false,
      timer: null,
      touched: false,
      unsubscribe: () => undefined,
      written: null,
    };
    tracker.unsubscribe = document.store.subscribe((state, previous) => {
      observe(document, tracker, state.editor !== previous.editor);
    });
    trackers.set(tabId, tracker);
    observe(document, tracker, false);
  };

  const untrack = (tabId: string) => {
    const tracker = trackers.get(tabId);
    if (!tracker) return;
    tracker.unsubscribe();
    clearTimer(tracker);
    trackers.delete(tabId);
  };

  const syncTabs = () => {
    const open = new Set(tabs.store.getState().tabs.map((tab) => tab.id));
    for (const tabId of trackers.keys()) if (!open.has(tabId)) untrack(tabId);
    for (const tabId of open) {
      if (trackers.has(tabId)) continue;
      const document = tabs.getDocument(tabId);
      if (document) track(tabId, document);
    }
  };

  const unsubscribeTabs = tabs.subscribe(syncTabs);
  syncTabs();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeTabs();
      for (const tabId of trackers.keys()) untrack(tabId);
      controller.abort();
    },
    state() {
      const documents: Record<string, JournaledDocumentState> = {};
      for (const [tabId, tracker] of trackers) {
        documents[tabId] = { failures: tracker.failures, phase: tracker.phase };
      }
      return { documents, lastFailure, suspended };
    },
  };
}
