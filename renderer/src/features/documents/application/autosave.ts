/**
 * Writing a dirty editor without being asked.
 *
 * Autosave is the only writer that fires on its own, so it is also the only
 * one that must know when not to. A state the reader has to answer first
 * never schedules a write: a conflict and an unfinished merge are waiting on a
 * decision, and a detached draft has no file to write to, so retrying it every
 * keystroke would report a standing condition as a passing failure.
 */
import type { StoreApi } from 'zustand/vanilla';

import { isDocumentDirty, type DocumentState } from '@/features/documents/domain/document';

import type { DocumentSourcePort } from './ports';

/** How long an editor must sit still before its text is written. */
const AUTOSAVE_IDLE_MS = 500;

export interface AutosaveOptions {
  /** Absent, the document has no autosave at all. */
  api?: DocumentSourcePort | undefined;
  save(api: DocumentSourcePort): Promise<boolean>;
  store: StoreApi<DocumentState>;
}

/**
 * Starts autosaving `store`'s editor. Answers a disposer that both stops
 * listening and drops a write that has not fired yet; callers that must not be
 * written to for a while (a pending file mutation) call it and subscribe again.
 */
export function watchAutosave({ api, save, store }: AutosaveOptions): {
  cancelPending(): void;
  dispose(): void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancelPending = () => clearTimeout(timer);
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.editor?.revision === previous.editor?.revision) return;
    cancelPending();
    const editor = state.editor;
    if (
      !state.mutationPending &&
      api &&
      editor &&
      isDocumentDirty(editor) &&
      editor.save.kind !== 'merging' &&
      editor.save.kind !== 'conflict' &&
      editor.save.kind !== 'detached'
    ) {
      timer = setTimeout(() => void save(api), AUTOSAVE_IDLE_MS);
    }
  });
  return {
    cancelPending,
    dispose() {
      cancelPending();
      unsubscribe();
    },
  };
}
