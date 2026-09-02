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

import type { DocumentQueryScope } from './ports';

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
  activate(tabId: string): void;
  close(tabId: string): void;
  dispose(): void;
  getDocument(tabId: string): DocumentRuntime | null;
  open(source: SourceReference): DocumentRuntime | null;
  toSession(): DocumentSessionProjection;
}

export interface DocumentTabsRuntimeOptions {
  createId: () => string;
  createQueries: (scope: DocumentScope) => DocumentQueryScope;
  folderPath: string;
  generation: number;
  restored?: RestoredDocumentTabs | null;
}

export function createDocumentTabsRuntime({
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
      if (disposed) return;
      store.setState((state) => activateDocumentTab(state, tabId));
    },
    close(tabId) {
      if (disposed) return;
      const document = documents.get(tabId);
      if (!document) return;
      document.dispose();
      documents.delete(tabId);
      sourceIds.delete(sourceIdentity(document.scope.source));
      store.setState((state) => closeDocumentTab(state, tabId));
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
    getDocument(tabId) {
      return documents.get(tabId) ?? null;
    },
    open(source) {
      if (disposed) return null;
      const existingId = sourceIds.get(sourceIdentity(source));
      if (existingId) {
        runtime.activate(existingId);
        return documents.get(existingId) ?? null;
      }
      const id = createId();
      if (id.trim().length === 0 || documents.has(id)) {
        throw new Error('Document tab IDs must be non-empty and unique.');
      }
      const document = createChild(id, source);
      store.setState((state) => openDocumentTab(state, { id, source }));
      return document;
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
