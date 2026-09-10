/**
 * One open document's coordination seam: it owns the abortable scope, keeps
 * saves serialized so two writes never race, and turns a refused save into
 * the domain's conflict or failure state. Reader-facing sentences come from
 * `failure-messages`, never from here.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import { buildConflictMarkerDraft } from '@/features/documents/domain/conflict-diff';
import {
  acceptDocumentOverwrite,
  acceptDocumentSave,
  beginDocumentConflictResolution,
  beginDocumentSave,
  changeDocumentText,
  createDocumentState,
  documentAccess,
  disposeDocumentState,
  documentConflict,
  documentEditorText,
  enterDocumentConflict,
  failDocumentConflictResolution,
  isDocumentDirty,
  mergeDocumentConflict,
  reconcileDocumentSource,
  reloadDocumentConflict,
  rejectDocumentSave,
  sameSource,
  setDocumentJsonSession,
  setDocumentMarkdownMode,
  setDocumentPdfPage,
  type DocumentConflictResolution,
  type DocumentScope,
  type DocumentState,
  type DocumentTextSource,
  type JsonDocumentSession,
  type MarkdownViewMode,
} from '@/features/documents/domain/document';
import { documentTextFormat } from '@/features/documents/domain/document-format';
import { restoreDocumentDraft, type RecoveredDraft } from '@/features/documents/domain/recovery';
import type { SourceReference } from '@/shared/domain/source-reference';
import { createScopeGuard, type CapturedScope } from '@/shared/runtime/scope-guard';

import {
  documentFailure,
  DOCUMENT_OVERWRITE_MESSAGES,
  DOCUMENT_SAVE_MESSAGES,
} from './failure-messages';
import { DocumentSaveError, type DocumentQueryScope, type DocumentSourcePort } from './ports';

/** What one document operation was started under: the document's scope, and
 *  the generation of operations live at the time. The scope alone cannot tell a
 *  save that raced a conflict resolution apart from one aimed at the text now
 *  on screen, which is why the generation travels beside it. */
type DocumentOperationScope = CapturedScope<DocumentScope>;

/** A restore waits for the source to land first. A load that never settles
 *  (the folder went away, the server is gone) must not hold the reader's
 *  decision open forever, so the wait is bounded. */
export const DOCUMENT_RESTORE_WAIT_MS = 20_000;

/** How loading a recovered draft went: it is in the editor as unsaved text,
 *  it matched the disk text and changed nothing, or the document refused it
 *  (disposed, read-only, mid-conflict, or a source that never loaded). */
export type DocumentRestoreOutcome = 'refused' | 'restored' | 'unchanged';

export interface DocumentRuntime {
  readonly scope: DocumentScope;
  readonly signal: AbortSignal;
  readonly store: StoreApi<DocumentState>;
  /** Runs `completion` only when the operation `captured` was started under is
   *  still the live one: same document scope, no newer retirement, and a
   *  runtime that has not been disposed. Answers whether it ran, so a caller
   *  can drop the rest of a stale completion too. */
  accept(captured: DocumentOperationScope, completion: () => void): boolean;
  /** The token an operation is started under. Take it before the operation's
   *  first `await` and hand it back to `accept` afterwards: capturing at
   *  completion time would compare the live scope with itself and guard
   *  nothing. */
  capture(): DocumentOperationScope;
  change(value: string): void;
  dispose(): void;
  reconcile(source: DocumentTextSource): void;
  /** Retires every operation in flight, so their completions are refused. The
   *  document stays open: what changed is the text those completions were
   *  about. */
  retireOperations(): void;
  resolveConflict(
    api: DocumentSourcePort,
    resolution: DocumentConflictResolution,
  ): Promise<boolean>;
  /** Loads a recovered draft over the source as unsaved text once the source
   *  has landed. Never writes the source: the save lifecycle decides. */
  restoreDraft(draft: RecoveredDraft): Promise<DocumentRestoreOutcome>;
  save(api: DocumentSourcePort): Promise<boolean>;
  setJsonSession(patch: Partial<JsonDocumentSession>): void;
  setMarkdownMode(mode: MarkdownViewMode): void;
  setPdfPage(page: number): void;
}

export interface DocumentRuntimeOptions {
  activeFolderPath: string;
  generation: number;
  id: string;
  queries: DocumentQueryScope;
  source: SourceReference;
}

export function createDocumentRuntime({
  activeFolderPath,
  generation,
  id,
  queries,
  source,
}: DocumentRuntimeOptions): DocumentRuntime {
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error('Document runtime generation must be a positive safe integer.');
  }
  if (id.trim().length === 0) throw new Error('Document runtime ID must not be empty.');
  if (source.folderPath.trim().length === 0 || source.path.trim().length === 0) {
    throw new Error('Document source paths must not be empty.');
  }

  const scope: DocumentScope = Object.freeze({
    generation,
    id,
    source: Object.freeze({ ...source }),
  });
  const controller = new AbortController();
  const store = createStore<DocumentState>(() =>
    createDocumentState(scope, documentAccess(source, activeFolderPath)),
  );
  let disposed = false;
  let saveInFlight: Promise<boolean> | null = null;

  const { accept, capture, retireOperations } = createScopeGuard<DocumentScope>({
    disposed: () => disposed,
    sameScope: (captured, live) =>
      captured.generation === live.generation &&
      captured.id === live.id &&
      sameSource(captured.source, live.source),
    scope: () => scope,
  });

  const performSave = async (api: DocumentSourcePort): Promise<boolean> => {
    const before = store.getState();
    const editor = before.editor;
    if (!editor || !isDocumentDirty(editor) || before.lifecycle === 'disposed') return true;
    const captured = capture();
    const capturedRevision = editor.revision;
    const input = { baseVersion: editor.version, content: editor.value };
    store.setState(beginDocumentSave);
    try {
      const saved = await api.save(captured.scope.source, input, controller.signal);
      return accept(captured, () => {
        queries.replaceSource(saved);
        store.setState((state) => acceptDocumentSave(state, capturedRevision, saved));
      });
    } catch (error) {
      const conflict = error instanceof DocumentSaveError && error.kind === 'conflict';
      if (conflict) {
        try {
          const diskSource = await api.load(captured.scope.source, controller.signal);
          accept(captured, () => {
            queries.replaceSource(diskSource);
            store.setState((state) => enterDocumentConflict(state, diskSource));
          });
        } catch {
          accept(captured, () =>
            store.setState((state) => rejectDocumentSave(state, DOCUMENT_SAVE_MESSAGES.conflict)),
          );
        }
        return false;
      }
      accept(captured, () =>
        store.setState((state) =>
          rejectDocumentSave(
            state,
            documentFailure(error, 'DocumentSaveError', DOCUMENT_SAVE_MESSAGES).message,
          ),
        ),
      );
      return false;
    }
  };

  /** Resolves once the editor holds loaded text, or with null when the
   *  document is gone or the wait ran out. */
  const editorLanded = (): Promise<DocumentState['editor']> =>
    new Promise((resolve) => {
      const loaded = store.getState().editor;
      if (loaded) {
        resolve(loaded);
        return;
      }
      const watch: { stop: () => void } = { stop: () => undefined };
      const settle = (editor: DocumentState['editor']) => {
        watch.stop();
        resolve(editor);
      };
      const unsubscribe = store.subscribe((state) => {
        if (state.editor || state.lifecycle === 'disposed') settle(state.editor);
      });
      const timeout = setTimeout(() => settle(null), DOCUMENT_RESTORE_WAIT_MS);
      const onAbort = () => settle(null);
      controller.signal.addEventListener('abort', onAbort);
      watch.stop = () => {
        unsubscribe();
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', onAbort);
      };
    });

  const save = async (api: DocumentSourcePort): Promise<boolean> => {
    while (true) {
      const pendingSave = saveInFlight;
      if (pendingSave) {
        if (!(await pendingSave)) return false;
        continue;
      }
      const editor = store.getState().editor;
      if (!editor) return true;
      if (editor.save.kind === 'conflict') return false;
      if (!isDocumentDirty(editor)) return true;
      const run = performSave(api);
      saveInFlight = run;
      let succeeded: boolean;
      try {
        succeeded = await run;
      } finally {
        if (saveInFlight === run) saveInFlight = null;
      }
      if (!succeeded) return false;
    }
  };

  return {
    scope,
    signal: controller.signal,
    store,
    accept,
    capture,
    change(value) {
      if (disposed) return;
      store.setState((state) => changeDocumentText(state, value));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      retireOperations();
      controller.abort();
      // Cancelling in-flight reads is best effort during teardown.
      // swallowed: the document is already gone, so a rejected cancellation has no reader.
      void queries.cancel().catch(() => undefined);
      queries.remove();
      store.setState(disposeDocumentState);
    },
    reconcile(nextSource) {
      if (disposed) return;
      // The bytes under the editor were replaced, so a save still in flight is
      // no longer about the text this document holds.
      retireOperations();
      store.setState((state) => reconcileDocumentSource(state, nextSource));
    },
    async resolveConflict(api, resolution) {
      if (disposed) return false;
      const before = store.getState();
      const editorState = before.editor;
      const conflict = editorState ? documentConflict(editorState) : null;
      if (!conflict || conflict.resolving) return false;
      const format = documentTextFormat(scope.source.path);
      if (!format) return false;
      store.setState((state) => beginDocumentConflictResolution(state, resolution));
      const diskSource = {
        content: conflict.diskContent,
        format,
        version: conflict.diskVersion,
      };

      // Both local resolutions rebase the editor on what is now on disk, so
      // anything still in flight against the old base is retired first.
      if (resolution === 'reload') {
        retireOperations();
        queries.replaceSource(diskSource);
        store.setState(reloadDocumentConflict);
        return true;
      }
      if (resolution === 'merge') {
        retireOperations();
        const merged = buildConflictMarkerDraft(conflict.editorContent, conflict.diskContent);
        queries.replaceSource(diskSource);
        store.setState((state) => mergeDocumentConflict(state, merged));
        return true;
      }

      const captured = capture();
      try {
        const saved = await api.overwrite(
          captured.scope.source,
          { content: conflict.editorContent },
          controller.signal,
        );
        return accept(captured, () => {
          queries.replaceSource(saved);
          store.setState((state) => acceptDocumentOverwrite(state, saved));
        });
      } catch (error) {
        accept(captured, () =>
          store.setState((state) =>
            failDocumentConflictResolution(
              state,
              documentFailure(error, 'DocumentSaveError', DOCUMENT_OVERWRITE_MESSAGES).message,
            ),
          ),
        );
        return false;
      }
    },
    async restoreDraft(draft) {
      if (disposed) return 'refused';
      // The wait is not a guarded operation: the document's scope is fixed for
      // its life, and the source landing is what the restore is waiting for.
      const editor = await editorLanded();
      if (!editor || disposed) return 'refused';
      const before = store.getState();
      const after = restoreDocumentDraft(before, draft);
      if (after !== before) {
        store.setState(after);
        return 'restored';
      }
      return before.editor && documentEditorText(draft.content) === before.editor.baseline
        ? 'unchanged'
        : 'refused';
    },
    retireOperations,
    save,
    setJsonSession(patch) {
      if (disposed) return;
      store.setState((state) => setDocumentJsonSession(state, patch));
    },
    setMarkdownMode(mode) {
      if (disposed) return;
      store.setState((state) => setDocumentMarkdownMode(state, mode));
    },
    setPdfPage(page) {
      if (disposed) return;
      store.setState((state) => setDocumentPdfPage(state, page));
    },
  };
}
