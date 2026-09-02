import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  acceptDocumentSave,
  beginDocumentSave,
  changeDocumentText,
  createDocumentState,
  documentAccess,
  disposeDocumentState,
  reconcileDocumentSource,
  rejectDocumentSave,
  sameSource,
  type DocumentScope,
  type DocumentState,
  type DocumentTextSource,
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
  save(api: DocumentSourceApi): Promise<boolean>;
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
      store.setState((state) =>
        rejectDocumentSave(state, {
          conflictVersion: conflict ? error.currentVersion : null,
          message:
            error instanceof DocumentSaveError
              ? error.message
              : 'The document could not be saved. Your changes are still available.',
          phase: conflict ? 'conflict' : 'error',
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
      if (!store.getState().editor?.dirty) return true;
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
    save,
  };
}
