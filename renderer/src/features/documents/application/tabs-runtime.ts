import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  createDocumentRuntime,
  type DocumentRuntime,
} from '@/features/documents/application/document-runtime';
import { sourceIdentity, type DocumentScope } from '@/features/documents/domain/document';
import {
  activateDocumentTab,
  closeDocumentTab,
  createDocumentTabsState,
  disposeDocumentTabsState,
  openDocumentTab,
  type DocumentTabsState,
  type RestoredDocumentTabs,
} from '@/features/documents/domain/tabs';
import type { SourceReference } from '@/shared/domain/source-reference';

import type { DocumentQueryScope, DocumentSourceApi } from './ports';

export interface DocumentTabsScope {
  readonly folderPath: string;
  readonly generation: number;
}

export interface DocumentSessionProjection {
  activeTabId: string | null;
  tabs: Array<{ id: string; path: string }>;
}

export interface DocumentTabsRuntime {
  readonly scope: DocumentTabsScope;
  readonly signal: AbortSignal;
  readonly store: StoreApi<DocumentTabsState>;
  accept(capturedScope: DocumentTabsScope, completion: () => void): boolean;
  activate(tabId: string): Promise<boolean>;
  close(tabId: string): Promise<boolean>;
  dispose(): void;
  flush(): Promise<boolean>;
  getDocument(tabId: string): DocumentRuntime | null;
  open(source: SourceReference): Promise<DocumentRuntime | null>;
  toSession(): DocumentSessionProjection;
}

export interface DocumentTabsRuntimeOptions {
  api: DocumentSourceApi;
  createId: () => string;
  createQueries: (scope: DocumentScope) => DocumentQueryScope;
  folderPath: string;
  generation: number;
  restored?: RestoredDocumentTabs | null;
}

export function createDocumentTabsRuntime({
  api,
  createId,
  createQueries,
  folderPath,
  generation,
  restored = null,
}: DocumentTabsRuntimeOptions): DocumentTabsRuntime {
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error('Document tabs generation must be a positive safe integer.');
  }
  if (folderPath.trim().length === 0) {
    throw new Error('Document tabs folder path must not be empty.');
  }

  const scope: DocumentTabsScope = Object.freeze({ folderPath, generation });
  const controller = new AbortController();
  const initialState = createDocumentTabsState(restored);
  const store = createStore<DocumentTabsState>(() => initialState);
  const documents = new Map<string, DocumentRuntime>();
  const sourceIds = new Map<string, string>();
  let nextDocumentGeneration = 0;
  let disposed = false;
  let transitionTail: Promise<void> = Promise.resolve();

  function enqueueTransition<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = transitionTail.then(operation, operation);
    transitionTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  const saveDocuments = async (items: Iterable<DocumentRuntime>): Promise<boolean> => {
    for (const document of items) {
      if (!(await document.save(api))) return false;
    }
    return true;
  };

  const createChild = (id: string, source: SourceReference) => {
    const childGeneration = ++nextDocumentGeneration;
    const childScope = { generation: childGeneration, id, source };
    const runtime = createDocumentRuntime({
      activeFolderPath: folderPath,
      generation: childGeneration,
      id,
      queries: createQueries(childScope),
      source,
    });
    documents.set(id, runtime);
    sourceIds.set(sourceIdentity(source), id);
    return runtime;
  };

  for (const tab of initialState.tabs) createChild(tab.id, tab.source);

  const runtime: DocumentTabsRuntime = {
    scope,
    signal: controller.signal,
    store,
    accept(capturedScope, completion) {
      if (
        disposed ||
        capturedScope.generation !== scope.generation ||
        capturedScope.folderPath !== scope.folderPath
      ) {
        return false;
      }
      completion();
      return true;
    },
    activate(tabId) {
      return enqueueTransition(async () => {
        if (disposed) return false;
        const state = store.getState();
        if (state.activeTabId === tabId) return documents.has(tabId);
        if (!documents.has(tabId)) return false;
        const active = state.activeTabId ? documents.get(state.activeTabId) : null;
        if (active && !(await active.save(api))) return false;
        if (disposed || !documents.has(tabId)) return false;
        store.setState((current) => activateDocumentTab(current, tabId));
        return true;
      });
    },
    close(tabId) {
      return enqueueTransition(async () => {
        if (disposed) return false;
        const document = documents.get(tabId);
        if (!document || !(await document.save(api))) return false;
        if (disposed || documents.get(tabId) !== document) return false;
        document.dispose();
        documents.delete(tabId);
        sourceIds.delete(sourceIdentity(document.scope.source));
        store.setState((state) => closeDocumentTab(state, tabId));
        return true;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      for (const document of documents.values()) document.dispose();
      documents.clear();
      sourceIds.clear();
      store.setState(disposeDocumentTabsState);
    },
    flush() {
      return enqueueTransition(async () => {
        if (disposed) return false;
        return saveDocuments([...documents.values()]);
      });
    },
    getDocument(tabId) {
      return documents.get(tabId) ?? null;
    },
    open(source) {
      return enqueueTransition(async () => {
        if (disposed) return null;
        const state = store.getState();
        const existingId = sourceIds.get(sourceIdentity(source));
        if (existingId === state.activeTabId) return documents.get(existingId) ?? null;
        const active = state.activeTabId ? documents.get(state.activeTabId) : null;
        if (active && !(await active.save(api))) return null;
        if (disposed) return null;
        if (existingId) {
          const existing = documents.get(existingId) ?? null;
          if (existing) store.setState((current) => activateDocumentTab(current, existingId));
          return existing;
        }
        const id = createId();
        if (id.trim().length === 0 || documents.has(id)) {
          throw new Error('Document tab IDs must be non-empty and unique.');
        }
        const document = createChild(id, source);
        store.setState((current) => openDocumentTab(current, { id, source }));
        return document;
      });
    },
    toSession() {
      const state = store.getState();
      const tabs = state.tabs
        .filter((tab) => tab.source.folderPath === scope.folderPath)
        .map((tab) => ({ id: tab.id, path: tab.source.path }));
      return {
        activeTabId: tabs.some((tab) => tab.id === state.activeTabId) ? state.activeTabId : null,
        tabs,
      };
    },
  };

  return runtime;
}
