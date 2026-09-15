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

export interface DocumentRuntime {
  readingPosition: { top: number; left: number } | null;
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
  finishMerge(api: DocumentSourcePort): Promise<boolean>;
  reconcile(source: DocumentTextSource): void;
  rebind(
    source: SourceReference,
    createQueries: (scope: DocumentScope) => DocumentQueryScope,
  ): void;
  setMutationPending(pending: boolean): void;
  /** Retires every operation in flight, so their completions are refused. The
   *  document stays open: what changed is the text those completions were
   *  about. */
  retireOperations(): void;
  resolveConflict(
    api: DocumentSourcePort,
    resolution: DocumentConflictResolution,
  ): Promise<boolean>;
  save(api: DocumentSourcePort): Promise<boolean>;
  setJsonSession(patch: Partial<JsonDocumentSession>): void;
  setMarkdownMode(mode: MarkdownViewMode): void;
  setPdfPage(page: number): void;
}

export interface DocumentRuntimeOptions {
  api?: DocumentSourcePort;
  activeFolderPath: string;
  generation: number;
  id: string;
  queries: DocumentQueryScope;
  source: SourceReference;
}

export function createDocumentRuntime({
  api: autosaveApi,
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

  let scope: DocumentScope = Object.freeze({
    generation,
    id,
    source: Object.freeze({ ...source }),
  });
  let controller = new AbortController();
  const store = createStore<DocumentState>(() =>
    createDocumentState(scope, documentAccess(source, activeFolderPath)),
  );
  let disposed = false;
  let saveInFlight: Promise<boolean> | null = null;
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

  const { accept, capture, retireOperations } = createScopeGuard<DocumentScope>({
    disposed: () => disposed,
    sameScope: (captured, live) =>
      captured.generation === live.generation &&
      captured.id === live.id &&
      sameSource(captured.source, live.source),
    scope: () => scope,
  });

  const performSave = async (api: DocumentSourcePort, merging = false): Promise<boolean> => {
    const before = store.getState();
    const editor = before.editor;
    if (!editor || !isDocumentDirty(editor) || before.lifecycle === 'disposed') return true;
    const captured = capture();
    const capturedRevision = editor.revision;
    const input = { baseVersion: editor.version, content: editor.value };
    if (merging)
      store.setState((state) => ({
        ...state,
        editor: state.editor && {
          ...state.editor,
          save: { kind: 'merging', finishing: true, message: null },
        },
      }));
    else store.setState(beginDocumentSave);
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

  const save = async (api: DocumentSourcePort): Promise<boolean> => {
    while (true) {
      const pendingSave = saveInFlight;
      if (pendingSave) {
        if (!(await pendingSave)) return false;
        continue;
      }
      const editor = store.getState().editor;
      if (!editor) return true;
      if (editor.save.kind === 'conflict' || editor.save.kind === 'merging') return false;
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

  const unsubscribeAutosave = store.subscribe((state, previous) => {
    if (state.editor?.revision === previous.editor?.revision) return;
    clearTimeout(autosaveTimer);
    const editor = state.editor;
    if (
      !state.mutationPending &&
      autosaveApi &&
      editor &&
      isDocumentDirty(editor) &&
      editor.save.kind !== 'merging' &&
      editor.save.kind !== 'conflict'
    ) {
      autosaveTimer = setTimeout(() => {
        void save(autosaveApi);
      }, 500);
    }
  });

  return {
    readingPosition: null,
    get scope() {
      return scope;
    },
    get signal() {
      return controller.signal;
    },
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
      clearTimeout(autosaveTimer);
      unsubscribeAutosave();
      retireOperations();
      controller.abort();
      // Cancelling in-flight reads is best effort during teardown.
      // swallowed: the document is already gone, so a rejected cancellation has no reader.
      void queries.cancel().catch(() => undefined);
      queries.remove();
      store.setState(disposeDocumentState);
    },
    setMutationPending(pending) {
      clearTimeout(autosaveTimer);
      store.setState((state) => ({ ...state, mutationPending: pending }));
    },
    rebind(nextSource, createQueries) {
      if (disposed) return;
      retireOperations();
      controller.abort();
      controller = new AbortController();
      queries.remove();
      scope = Object.freeze({
        ...scope,
        generation: scope.generation + 1,
        source: Object.freeze({ ...nextSource }),
      });
      queries = createQueries(scope);
      const editor = store.getState().editor;
      const format = documentTextFormat(nextSource.path);
      if (editor && format)
        queries.replaceSource({ content: editor.baseline, format, version: editor.version });
      store.setState((state) => ({ ...state, scope }));
    },
    reconcile(nextSource) {
      if (disposed) return;
      const next = reconcileDocumentSource(store.getState(), nextSource);
      if (next === store.getState()) return;
      // The bytes under the editor were replaced, so a save still in flight is
      // no longer about the text this document holds.
      retireOperations();
      store.setState(next);
    },
    async finishMerge(api) {
      const editor = store.getState().editor;
      if (disposed || saveInFlight || editor?.save.kind !== 'merging' || editor.save.finishing)
        return false;
      if (/^(?:<<<<<<< Editor Version|>>>>>>> Disk Version)\s*$/mu.test(editor.value)) {
        store.setState((state) =>
          rejectDocumentSave(state, 'Resolve the marked conflicts before finishing the merge.'),
        );
        return false;
      }
      const run = performSave(api, true);
      saveInFlight = run;
      try {
        return await run;
      } finally {
        if (saveInFlight === run) saveInFlight = null;
      }
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
        const saved = await api.save(
          captured.scope.source,
          { baseVersion: conflict.diskVersion, content: conflict.editorContent },
          controller.signal,
        );
        return accept(captured, () => {
          queries.replaceSource(saved);
          store.setState((state) => acceptDocumentOverwrite(state, saved));
        });
      } catch (error) {
        if (error instanceof DocumentSaveError && error.kind === 'conflict') {
          try {
            const disk = await api.load(captured.scope.source, controller.signal);
            accept(captured, () => store.setState((state) => enterDocumentConflict(state, disk)));
            return false;
          } catch {
            /* Keep both reviewed versions if the newer source cannot be read. */
          }
        }
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
