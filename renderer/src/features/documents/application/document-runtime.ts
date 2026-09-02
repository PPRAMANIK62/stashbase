import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  createDocumentState,
  disposeDocumentState,
  sameSource,
  type DocumentScope,
  type DocumentState,
} from '@/features/documents/domain/document';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface DocumentRuntime {
  readonly scope: DocumentScope;
  readonly signal: AbortSignal;
  readonly store: StoreApi<DocumentState>;
  accept(capturedScope: DocumentScope, completion: () => void): boolean;
  dispose(): void;
}

export interface DocumentRuntimeOptions {
  generation: number;
  id: string;
  source: SourceReference;
}

export function createDocumentRuntime({
  generation,
  id,
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
  const store = createStore<DocumentState>(() => createDocumentState(scope));
  let disposed = false;

  return {
    scope,
    signal: controller.signal,
    store,
    accept(capturedScope, completion) {
      if (
        disposed ||
        capturedScope.generation !== scope.generation ||
        capturedScope.id !== scope.id ||
        !sameSource(capturedScope.source, scope.source)
      ) {
        return false;
      }
      completion();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      store.setState(disposeDocumentState);
    },
  };
}
