/**
 * One open document's coordination seam: it owns the abortable scope, keeps
 * saves serialized so two writes never race, and turns a refused save into
 * the domain's conflict or failure state. Reader-facing sentences come from
 * `failure-messages`, never from here.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import { enterDocumentConflict } from '@/features/documents/domain/conflict-state';
import {
  acceptDocumentSave,
  beginDocumentSave,
  changeDocumentText,
  createDocumentState,
  detachDocumentSave,
  documentAccess,
  disposeDocumentState,
  isDocumentDirty,
  reconcileDocumentSource,
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

import { watchAutosave } from './autosave';
import { resolveDocumentConflict, type ConflictResolutionContext } from './conflict-resolution';
import { documentFailure, DOCUMENT_SAVE_MESSAGES } from './failure-messages';
import {
  DocumentSaveError,
  DocumentSourceError,
  type DocumentQueryScope,
  type DocumentSourcePort,
} from './ports';

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
  /** Writes a detached draft back to the path its file was deleted from.
   *  Answers whether the draft now has a file. Only the reader may ask: this
   *  is the one write that creates a source the app did not find. */
  restore(api: DocumentSourcePort): Promise<boolean>;
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
        } catch (loadError) {
          // The write was refused against a version the file no longer has,
          // and the read confirms why: there is no file. That is not a
          // comparison the reader can make, so the draft detaches instead.
          const gone =
            loadError instanceof DocumentSourceError && loadError.kind === 'missing'
              ? DOCUMENT_SAVE_MESSAGES.missing
              : null;
          accept(captured, () =>
            store.setState((state) =>
              gone === null
                ? rejectDocumentSave(state, DOCUMENT_SAVE_MESSAGES.conflict)
                : detachDocumentSave(state, gone),
            ),
          );
        }
        return false;
      }
      const message = documentFailure(error, 'DocumentSaveError', DOCUMENT_SAVE_MESSAGES).message;
      // A missing destination is not a write that might work next time. It
      // becomes the document's standing state so autosave stops and the reader
      // is left with the explicit restore.
      const detached = error instanceof DocumentSaveError && error.kind === 'missing';
      accept(captured, () =>
        store.setState((state) =>
          detached ? detachDocumentSave(state, message) : rejectDocumentSave(state, message),
        ),
      );
      return false;
    }
  };

  /** The one write that may create a file the app did not find. It is reached
   *  only from `restore`, after a save has re-confirmed the source is gone. */
  const performCreate = async (
    api: DocumentSourcePort,
    captured: DocumentOperationScope,
    capturedRevision: number,
    content: string,
  ): Promise<boolean> => {
    try {
      const created = await api.overwrite(captured.scope.source, { content }, controller.signal);
      return accept(captured, () => {
        queries.replaceSource(created);
        store.setState((state) => acceptDocumentSave(state, capturedRevision, created));
      });
    } catch (error) {
      const message = documentFailure(error, 'DocumentSaveError', DOCUMENT_SAVE_MESSAGES).message;
      accept(captured, () => store.setState((state) => detachDocumentSave(state, message)));
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

  const resolutionContext: ConflictResolutionContext = {
    accept,
    capture,
    queries,
    retireOperations,
    get scope() {
      return scope;
    },
    signal: controller.signal,
    store,
  };

  const autosave = watchAutosave({ api: autosaveApi, save, store });

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
      autosave.dispose();
      retireOperations();
      controller.abort();
      // Cancelling in-flight reads is best effort during teardown.
      // swallowed: the document is already gone, so a rejected cancellation has no reader.
      void queries.cancel().catch(() => undefined);
      queries.remove();
      store.setState(disposeDocumentState);
    },
    setMutationPending(pending) {
      autosave.cancelPending();
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
    resolveConflict(api, resolution) {
      return disposed
        ? Promise.resolve(false)
        : resolveDocumentConflict(resolutionContext, api, resolution);
    },
    /**
     * Writes a detached draft back to the path its file was deleted from.
     *
     * An ordinary save runs first, because the file may have come back since
     * the draft detached: that lands, or it becomes the comparison the reader
     * decides in. Only a save that re-confirms the file is gone reaches the
     * create below, so this can never overwrite something that reappeared.
     */
    async restore(api) {
      if (disposed || store.getState().editor?.save.kind !== 'detached') return false;
      if (await save(api)) return true;
      const editor = store.getState().editor;
      if (disposed || editor?.save.kind !== 'detached') return false;
      const captured = capture();
      const capturedRevision = editor.revision;
      const content = editor.value;
      store.setState(beginDocumentSave);
      const run = performCreate(api, captured, capturedRevision, content);
      saveInFlight = run;
      try {
        return await run;
      } finally {
        if (saveInFlight === run) saveInFlight = null;
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
