/**
 * The open-document set: which tabs exist, which one is active, and the
 * per-document runtime behind each. Closing a tab disposes its runtime, so an
 * in-flight load or save for a retired document can never land.
 *
 * Browsing opens a preview: one tab that the next browse reuses. A preview
 * is kept once the reader asks or the moment its text is edited, and the
 * history beside the set records where the reader has been, by source, so
 * stepping back reaches a preview that has since been replaced.
 */
import { createStore } from 'zustand/vanilla';

import {
  createDocumentRuntime,
  type DocumentRuntime,
} from '@/features/documents/application/document-runtime';
import { isDocumentDirty, sourceIdentity } from '@/features/documents/domain/document';
import type { DocumentVisit } from '@/features/documents/domain/history';
import type { DocumentLocation } from '@/features/documents/domain/location';
import {
  activateDocumentTab,
  closeDocumentTab,
  createDocumentTabsState,
  disposeDocumentTabsState,
  keepDocumentTab,
  openDocumentTab,
  previewDocumentTab,
  type DocumentTabsState,
} from '@/features/documents/domain/tabs';
import type { SourceReference } from '@/shared/domain/source-reference';
import { createScopeGuard } from '@/shared/runtime/scope-guard';

import { createDocumentHistoryRuntime } from './history-runtime';
import { createDocumentNavigationRuntime } from './navigation-runtime';
import type {
  DocumentOpenOptions,
  DocumentTabsRuntime,
  DocumentTabsRuntimeOptions,
  DocumentTabsScope,
} from './tabs-contract';

export type { DocumentOpenOptions, DocumentTabsRuntime, DocumentTabsRuntimeOptions };

/** The location an open or a visit names, with absent fields left out so
 *  the exact-optional shapes downstream accept it. */
function visitLocation(location: DocumentLocation): DocumentLocation {
  return {
    ...(location.anchor === undefined ? {} : { anchor: location.anchor }),
    ...(location.search === undefined ? {} : { search: location.search }),
  };
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
  const history = createDocumentHistoryRuntime();
  const documents = new Map<string, DocumentRuntime>();
  const sourceIds = new Map<string, string>();
  /** Each child's watch for its first edit, which is what keeps a preview. */
  const editWatches = new Map<string, () => void>();
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

  const keep = (tabId: string): boolean => {
    if (!documents.has(tabId)) return false;
    store.setState((current) => keepDocumentTab(current, tabId));
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
    // An edit is the reader saying the document is theirs to work in, so a
    // preview stops being one the moment its text moves.
    editWatches.set(
      id,
      runtime.store.subscribe((state) => {
        if (state.editor && isDocumentDirty(state.editor)) keep(id);
      }),
    );
    return runtime;
  };

  const retireChild = (id: string) => {
    const document = documents.get(id);
    if (!document) return;
    editWatches.get(id)?.();
    editWatches.delete(id);
    document.dispose();
    documents.delete(id);
    sourceIds.delete(sourceIdentity(document.scope.source));
  };

  const requestDocumentLocation = (document: DocumentRuntime, options: DocumentLocation) => {
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
    options: DocumentOpenOptions,
    record: boolean,
  ): DocumentRuntime | null => {
    const preview = options.preview === true;
    const existingId = sourceIds.get(identity);
    if (existingId !== undefined) {
      const existing = documents.get(existingId) ?? null;
      if (existing) {
        store.setState((current) => openDocumentTab(current, { id: existingId, source }, preview));
        navigation.activate(existingId);
        requestDocumentLocation(existing, options);
        if (record) history.record({ source, ...visitLocation(options) });
        guard.retireOperations();
      }
      return existing;
    }
    const id = createId();
    if (id.trim().length === 0 || documents.has(id)) {
      throw new Error('Document tab IDs must be non-empty and unique.');
    }
    // The standing preview gives its slot to the new one, unless it holds
    // an edit, in which case it is kept and the new preview goes beside it.
    // An edit keeps a tab the moment it is made, so this is a last guard.
    const standing = preview ? previewDocumentTab(store.getState()) : null;
    const standingEditor = standing ? documents.get(standing.id)?.store.getState().editor : null;
    if (standing && standingEditor && isDocumentDirty(standingEditor)) keep(standing.id);
    const replaced = preview ? previewDocumentTab(store.getState()) : null;
    const document = createChild(id, source);
    store.setState((current) => openDocumentTab(current, { id, source }, preview));
    if (replaced) retireChild(replaced.id);
    navigation.activate(id);
    requestDocumentLocation(document, options);
    if (record) history.record({ source, ...visitLocation(options) });
    guard.retireOperations();
    return document;
  };

  /** The whole open, run inside the transition queue. `record` is false for
   *  the history's own steps, which are returns rather than new visits. */
  const openTransition = async (
    source: SourceReference,
    options: DocumentOpenOptions,
    record: boolean,
  ): Promise<DocumentRuntime | null> => {
    if (disposed) return null;
    const identity = sourceIdentity(source);
    const openedId = sourceIds.get(identity);
    if (openedId !== undefined && openedId === store.getState().activeTabId) {
      const existing = documents.get(openedId) ?? null;
      if (existing) {
        if (options.preview !== true) keep(openedId);
        requestDocumentLocation(existing, options);
        if (record) history.record({ source, ...visitLocation(options) });
      }
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
      opened = openSource(source, identity, options, record);
    });
    return opened;
  };

  const stepHistory = (
    visit: () => DocumentVisit | null,
    step: () => void,
  ): Promise<DocumentRuntime | null> =>
    enqueueTransition(async () => {
      const target = visit();
      if (!target) return null;
      const opened = await openTransition(
        target.source,
        { ...visitLocation(target), preview: true },
        false,
      );
      if (opened) step();
      return opened;
    });

  for (const tab of initialState.tabs) createChild(tab.id, tab.source);
  // The tab the window comes back on is where the reader is, so the first
  // browse away from it has somewhere to step back to.
  const restoredActive = initialState.tabs.find((tab) => tab.id === initialState.activeTabId);
  if (restoredActive) history.record({ source: restoredActive.source });

  const runtime: DocumentTabsRuntime = {
    history,
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
          const document = documents.get(tabId);
          if (!document) return;
          store.setState((current) => activateDocumentTab(current, tabId));
          navigation.activate(tabId);
          history.record({ source: document.scope.source });
          guard.retireOperations();
          activated = true;
        });
        return activated;
      });
    },
    back: () => stepHistory(history.previous, history.stepBack),
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
          retireChild(tabId);
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
      // A Map iterates safely over its own deletions.
      for (const id of documents.keys()) retireChild(id);
      navigation.dispose();
      store.setState(disposeDocumentTabsState);
    },
    flush() {
      return enqueueTransition(async () => {
        if (disposed) return false;
        return saveDocuments([...documents.values()]);
      });
    },
    forward: () => stepHistory(history.next, history.stepForward),
    getDocument(tabId) {
      return documents.get(tabId) ?? null;
    },
    hasDocuments() {
      return store.getState().tabs.length > 0;
    },
    keep,
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
      return enqueueTransition(() => openTransition(source, options, true));
    },
    toSession() {
      const state = store.getState();
      // A preview was only ever a look, so it is not part of what the window
      // comes back to.
      const tabs = state.tabs
        .filter((tab) => !tab.preview && tab.source.folderPath === scope.folderPath)
        .map((tab) => ({ id: tab.id, path: tab.source.path }));
      return {
        activeTabId: tabs.some((tab) => tab.id === state.activeTabId) ? state.activeTabId : null,
        tabs,
      };
    },
  };

  return runtime;
}
