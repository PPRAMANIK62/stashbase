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
  documentTextFormat,
  disposeDocumentState,
  enterDocumentConflict,
  failDocumentConflictResolution,
  mergeDocumentConflict,
  reconcileDocumentSource,
  reloadDocumentConflict,
  rejectDocumentSave,
  sameSource,
  setDocumentJsonSession,
  setDocumentMarkdownMode,
  type DocumentConflictResolution,
  type DocumentScope,
  type DocumentState,
  type DocumentTextSource,
  type JsonDocumentSession,
  type MarkdownViewMode,
} from '@/features/documents/domain/document';
import type { SourceReference } from '@/shared/domain/source-reference';

import { DocumentSaveError, type DocumentQueryScope, type DocumentSourceApi } from './ports';

export interface DocumentRuntime {
  readonly scope: DocumentScope;
  readonly signal: AbortSignal;
  readonly store: StoreApi<DocumentState>;
  accept(capturedScope: DocumentScope, completion: () => void): boolean;
  change(value: string): void;
  dispose(): void;
  reconcile(source: DocumentTextSource): void;
  resolveConflict(api: DocumentSourceApi, resolution: DocumentConflictResolution): Promise<boolean>;
  save(api: DocumentSourceApi): Promise<boolean>;
  setJsonSession(patch: Partial<JsonDocumentSession>): void;
  setMarkdownMode(mode: MarkdownViewMode): void;
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

  const isLiveScope = (capturedScope: DocumentScope) =>
    !disposed &&
    capturedScope.generation === scope.generation &&
    capturedScope.id === scope.id &&
    sameSource(capturedScope.source, scope.source);

  const performSave = async (api: DocumentSourceApi): Promise<boolean> => {
    const before = store.getState();
    const editor = before.editor;
    if (!editor?.dirty || before.lifecycle === 'disposed') return true;
    const capturedScope = scope;
    const capturedRevision = editor.revision;
    const input = { baseVersion: editor.version, content: editor.value };
    store.setState(beginDocumentSave);
    try {
      const saved = await api.save(capturedScope.source, input, controller.signal);
      if (!isLiveScope(capturedScope)) return false;
      queries.replaceSource(saved);
      store.setState((state) => acceptDocumentSave(state, capturedRevision, saved));
      return true;
    } catch (error) {
      if (!isLiveScope(capturedScope)) return false;
      const conflict = error instanceof DocumentSaveError && error.kind === 'conflict';
      if (conflict) {
        try {
          const diskSource = await api.load(capturedScope.source, controller.signal);
          if (!isLiveScope(capturedScope)) return false;
          queries.replaceSource(diskSource);
          store.setState((state) =>
            enterDocumentConflict(
              state,
              diskSource,
              'The file changed on disk. Choose which version to keep.',
            ),
          );
        } catch {
          if (!isLiveScope(capturedScope)) return false;
          store.setState((state) =>
            rejectDocumentSave(state, {
              conflictVersion: error.currentVersion,
              message:
                'The file changed on disk, but its newer version could not be loaded. Retry to compare both versions.',
            }),
          );
        }
        return false;
      }
      store.setState((state) =>
        rejectDocumentSave(state, {
          conflictVersion: null,
          message:
            error instanceof DocumentSaveError
              ? error.message
              : 'The document could not be saved. Your changes are still available.',
        }),
      );
      return false;
    }
  };

  const save = async (api: DocumentSourceApi): Promise<boolean> => {
    while (true) {
      const pendingSave = saveInFlight;
      if (pendingSave) {
        if (!(await pendingSave)) return false;
        continue;
      }
      const editor = store.getState().editor;
      if (editor?.conflict) return false;
      if (!editor?.dirty) return true;
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
    accept(capturedScope, completion) {
      if (!isLiveScope(capturedScope)) return false;
      completion();
      return true;
    },
    change(value) {
      if (disposed) return;
      store.setState((state) => changeDocumentText(state, value));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      void queries.cancel().catch(() => undefined);
      queries.remove();
      store.setState(disposeDocumentState);
    },
    reconcile(nextSource) {
      if (disposed) return;
      store.setState((state) => reconcileDocumentSource(state, nextSource));
    },
    async resolveConflict(api, resolution) {
      if (disposed) return false;
      const before = store.getState();
      const conflict = before.editor?.conflict;
      if (!conflict || conflict.resolving) return false;
      const format = documentTextFormat(scope.source.path);
      if (!format) return false;
      store.setState((state) => beginDocumentConflictResolution(state, resolution));
      const diskSource = {
        content: conflict.diskContent,
        format,
        version: conflict.diskVersion,
      };

      if (resolution === 'reload') {
        queries.replaceSource(diskSource);
        store.setState(reloadDocumentConflict);
        return true;
      }
      if (resolution === 'merge') {
        const merged = buildConflictMarkerDraft(conflict.editorContent, conflict.diskContent);
        queries.replaceSource(diskSource);
        store.setState((state) => mergeDocumentConflict(state, merged));
        return true;
      }

      try {
        const saved = await api.overwrite(
          scope.source,
          { content: conflict.editorContent },
          controller.signal,
        );
        if (!isLiveScope(scope)) return false;
        queries.replaceSource(saved);
        store.setState((state) => acceptDocumentOverwrite(state, saved));
        return true;
      } catch (error) {
        if (!isLiveScope(scope)) return false;
        store.setState((state) =>
          failDocumentConflictResolution(
            state,
            error instanceof DocumentSaveError
              ? error.message
              : 'The document could not be overwritten. Both versions are still available.',
          ),
        );
        return false;
      }
    },
    save,
    setJsonSession(patch) {
      if (disposed) return;
      store.setState((state) => setDocumentJsonSession(state, patch));
    },
    setMarkdownMode(mode) {
      if (disposed) return;
      store.setState((state) => setDocumentMarkdownMode(state, mode));
    },
  };
}
