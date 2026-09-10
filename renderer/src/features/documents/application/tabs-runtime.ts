/**
 * The open-document set: which tabs exist, which one is active, and the
 * per-document runtime behind each. Closing a tab disposes its runtime, so an
 * in-flight load or save for a retired document can never land.
 */
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
import { createScopeGuard, type CapturedScope } from '@/shared/runtime/scope-guard';

import {
  createDocumentNavigationRuntime,
  type DocumentNavigationRuntime,
  type DocumentSearchTarget,
} from './navigation-runtime';
import type { DocumentQueryScope, DocumentSourcePort } from './ports';

interface DocumentTabsScope {
  readonly folderPath: string;
  readonly generation: number;
}

/** What one tabs transition was started under: the folder scope, and the
 *  generation of the open set at the time. A transition reads the active tab
 *  before it awaits a save, so the generation is what tells a resumed
 *  transition that the set it read has since moved. */
type CapturedTabsScope = CapturedScope<DocumentTabsScope>;

interface DocumentSessionProjection {
  activeTabId: string | null;
  tabs: Array<{ id: string; path: string }>;
}

export interface DocumentTabsRuntime {
  readonly navigation: DocumentNavigationRuntime;
  readonly scope: DocumentTabsScope;
  readonly signal: AbortSignal;
  readonly store: StoreApi<DocumentTabsState>;
  /** Runs `completion` only when `captured` is still the scope this runtime
   *  owns, the open set has not moved since, and the runtime is live. Answers
   *  whether it ran, so a caller can drop the rest of a stale completion too. */
  accept(captured: CapturedTabsScope, completion: () => void): boolean;
  activate(tabId: string): Promise<boolean>;
  /** The source in front of the reader, or null when nothing is open. */
  activeSource(): SourceReference | null;
  /** The token a transition is started under: the folder scope this collection
   *  is bound to, which is fixed for its life, and the generation of the open
   *  set as of now, which is not. */
  capture(): CapturedTabsScope;
  close(tabId: string): Promise<boolean>;
  /** Closes the tab in front of the reader, if there is one. */
  closeActive(): Promise<boolean>;
  /** Closes the tab showing `source`, if one is open. */
  closeSource(source: SourceReference): Promise<boolean>;
  dispose(): void;
  flush(): Promise<boolean>;
  getDocument(tabId: string): DocumentRuntime | null;
  /** Whether any document is open. */
  hasDocuments(): boolean;
  /** The sources behind the open tabs, as one cached array so a reader can
   *  compare it by identity across renders. */
  openSources(): readonly SourceReference[];
  /** Notifies `listener` whenever the open set or the active tab moves. */
  subscribe(listener: () => void): () => void;
  open(
    source: SourceReference,
    options?: { anchor?: string; search?: DocumentSearchTarget },
  ): Promise<DocumentRuntime | null>;
  toSession(): DocumentSessionProjection;
}

export interface DocumentTabsRuntimeOptions {
  api: DocumentSourcePort;
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
  const navigation = createDocumentNavigationRuntime(initialState.activeTabId);
  const documents = new Map<string, DocumentRuntime>();
  const sourceIds = new Map<string, string>();
  let nextDocumentGeneration = 0;
  let disposed = false;
  /** Derived from the tab list and rebuilt only when that list changes, so a
   *  subscriber can compare snapshots by identity. */
  let sourcesCache: { tabs: unknown; sources: readonly SourceReference[] } = {
    sources: [],
    tabs: null,
  };
  let transitionTail: Promise<void> = Promise.resolve();

  const guard = createScopeGuard<DocumentTabsScope>({
    disposed: () => disposed,
    sameScope: (captured, live) =>
      captured.generation === live.generation && captured.folderPath === live.folderPath,
    scope: () => scope,
  });

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

  const requestDocumentLocation = (
    document: DocumentRuntime,
    options: { anchor?: string; search?: DocumentSearchTarget },
  ) => {
    if (options.anchor) navigation.requestAnchor(document.scope.id, options.anchor);
    if (!options.search) return;
    navigation.requestSearch(document.scope.id, options.search);
  };

  /** The synchronous half of `open`, run only once a captured transition has
   *  been accepted: it reads the open set as it stands now, not as the
   *  transition found it before its save. */
  const openSource = (
    source: SourceReference,
    identity: string,
    options: { anchor?: string; search?: DocumentSearchTarget },
  ): DocumentRuntime | null => {
    const existingId = sourceIds.get(identity);
    if (existingId !== undefined) {
      const existing = documents.get(existingId) ?? null;
      if (existing) {
        store.setState((current) => activateDocumentTab(current, existingId));
        navigation.activate(existingId);
        requestDocumentLocation(existing, options);
        guard.retireOperations();
      }
      return existing;
    }
    const id = createId();
    if (id.trim().length === 0 || documents.has(id)) {
      throw new Error('Document tab IDs must be non-empty and unique.');
    }
    const document = createChild(id, source);
    store.setState((current) => openDocumentTab(current, { id, source }));
    navigation.activate(id);
    requestDocumentLocation(document, options);
    guard.retireOperations();
    return document;
  };

  for (const tab of initialState.tabs) createChild(tab.id, tab.source);

  const runtime: DocumentTabsRuntime = {
    navigation,
    scope,
    signal: controller.signal,
    store,
    activeSource() {
      const { activeTabId, tabs } = store.getState();
      return tabs.find((tab) => tab.id === activeTabId)?.source ?? null;
    },
    accept: guard.accept,
    activate(tabId) {
      return enqueueTransition(async () => {
        if (disposed) return false;
        const state = store.getState();
        if (state.activeTabId === tabId) return documents.has(tabId);
        if (!documents.has(tabId)) return false;
        const captured = guard.capture();
        const active = state.activeTabId ? documents.get(state.activeTabId) : null;
        if (active && !(await active.save(api))) return false;
        let activated = false;
        guard.accept(captured, () => {
          if (!documents.has(tabId)) return;
          store.setState((current) => activateDocumentTab(current, tabId));
          navigation.activate(tabId);
          guard.retireOperations();
          activated = true;
        });
        return activated;
      });
    },
    capture: guard.capture,
    closeActive() {
      const activeTabId = store.getState().activeTabId;
      return activeTabId === null ? Promise.resolve(false) : runtime.close(activeTabId);
    },
    closeSource(source) {
      const tabId = sourceIds.get(sourceIdentity(source));
      return tabId === undefined ? Promise.resolve(false) : runtime.close(tabId);
    },
    close(tabId) {
      return enqueueTransition(async () => {
        if (disposed) return false;
        const document = documents.get(tabId);
        const captured = guard.capture();
        if (!document || !(await document.save(api))) return false;
        let closed = false;
        guard.accept(captured, () => {
          if (documents.get(tabId) !== document) return;
          document.dispose();
          documents.delete(tabId);
          sourceIds.delete(sourceIdentity(document.scope.source));
          store.setState((state) => closeDocumentTab(state, tabId));
          navigation.activate(store.getState().activeTabId);
          guard.retireOperations();
          closed = true;
        });
        return closed;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      guard.retireOperations();
      controller.abort();
      for (const document of documents.values()) document.dispose();
      documents.clear();
      sourceIds.clear();
      navigation.dispose();
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
    hasDocuments() {
      return store.getState().tabs.length > 0;
    },
    openSources() {
      const { tabs } = store.getState();
      if (sourcesCache.tabs !== tabs) {
        sourcesCache = { sources: tabs.map((tab) => tab.source), tabs };
      }
      return sourcesCache.sources;
    },
    subscribe(listener) {
      return store.subscribe(listener);
    },
    open(source, options = {}) {
      return enqueueTransition(async () => {
        if (disposed) return null;
        const identity = sourceIdentity(source);
        const openedId = sourceIds.get(identity);
        if (openedId !== undefined && openedId === store.getState().activeTabId) {
          const existing = documents.get(openedId) ?? null;
          if (existing) requestDocumentLocation(existing, options);
          return existing;
        }
        const captured = guard.capture();
        const active = documents.get(store.getState().activeTabId ?? '') ?? null;
        if (active && !(await active.save(api))) return null;
        // The save spanned an await, so what was read before it — which tab was
        // active, whether this source was already open — is re-read here rather
        // than trusted.
        let opened: DocumentRuntime | null = null;
        guard.accept(captured, () => {
          opened = openSource(source, identity, options);
        });
        return opened;
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
