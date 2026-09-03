import { createStore, type StoreApi } from 'zustand/vanilla';

import type { DocumentHeading } from '@/features/documents/domain/outline';

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface FindMatchInfo {
  current: number;
  total: number;
}

export interface DocumentFindController {
  close(): void;
  next(): FindMatchInfo | Promise<FindMatchInfo>;
  previous(): FindMatchInfo | Promise<FindMatchInfo>;
  restoreQuery?(query: string, options: FindOptions): FindMatchInfo | Promise<FindMatchInfo>;
  setQuery(query: string, options: FindOptions): FindMatchInfo | Promise<FindMatchInfo>;
}

export interface DocumentFindState extends FindOptions, FindMatchInfo {
  available: boolean;
  focusRevision: number;
  open: boolean;
  query: string;
}

export interface DocumentOutlineState {
  activeId: string | null;
  available: boolean;
  headings: DocumentHeading[];
}

export interface PendingDocumentAnchor {
  id: string;
  tabId: string;
}

export interface DocumentNavigationState {
  find: DocumentFindState;
  outline: DocumentOutlineState;
  pendingAnchor: PendingDocumentAnchor | null;
}

export interface DocumentNavigationRuntime {
  readonly store: StoreApi<DocumentNavigationState>;
  activate(tabId: string | null): void;
  claimFind(tabId: string, owner: symbol, controller: DocumentFindController): () => void;
  claimOutline(tabId: string, owner: symbol): () => void;
  closeFind(): void;
  consumeAnchor(tabId: string, id: string): void;
  dispose(): void;
  findNext(): void;
  findPrevious(): void;
  openFind(): boolean;
  publishOutline(
    tabId: string,
    owner: symbol,
    outline: Omit<DocumentOutlineState, 'available'>,
    select: (heading: DocumentHeading) => void,
  ): void;
  requestAnchor(tabId: string, id: string): void;
  selectHeading(heading: DocumentHeading): void;
  setFindCaseSensitive(value: boolean): void;
  setFindQuery(query: string): void;
  setFindWholeWord(value: boolean): void;
}

const emptyOutline = (): DocumentOutlineState => ({
  activeId: null,
  available: false,
  headings: [],
});

export function createDocumentNavigationRuntime(
  initialActiveTabId: string | null,
): DocumentNavigationRuntime {
  const store = createStore<DocumentNavigationState>(() => ({
    find: {
      available: false,
      caseSensitive: false,
      current: 0,
      focusRevision: 0,
      open: false,
      query: '',
      total: 0,
      wholeWord: false,
    },
    outline: emptyOutline(),
    pendingAnchor: null,
  }));
  let activeTabId = initialActiveTabId;
  let disposed = false;
  let findController: DocumentFindController | null = null;
  let findOwner: symbol | null = null;
  let outlineOwner: symbol | null = null;
  let outlineSelect: ((heading: DocumentHeading) => void) | null = null;
  let requestSequence = 0;

  const updateFind = (patch: Partial<DocumentFindState>) => {
    store.setState((state) => ({ ...state, find: { ...state.find, ...patch } }));
  };

  const applyMatch = (pending: FindMatchInfo | Promise<FindMatchInfo>) => {
    const sequence = ++requestSequence;
    const expectedController = findController;
    void Promise.resolve(pending)
      .then((match) => {
        if (disposed || sequence !== requestSequence || findController !== expectedController)
          return;
        updateFind({ current: match.current, total: match.total });
      })
      .catch(() => {
        if (disposed || sequence !== requestSequence || findController !== expectedController)
          return;
        updateFind({ current: 0, total: 0 });
      });
  };

  const runQuery = (restore: boolean) => {
    const controller = findController;
    if (!controller) {
      updateFind({ current: 0, total: 0 });
      return;
    }
    const { caseSensitive, query, wholeWord } = store.getState().find;
    const command =
      restore && controller.restoreQuery ? controller.restoreQuery : controller.setQuery;
    applyMatch(command.call(controller, query, { caseSensitive, wholeWord }));
  };

  const clearFindOwner = () => {
    requestSequence += 1;
    findController?.close();
    findController = null;
    findOwner = null;
    updateFind({ available: false, current: 0, total: 0 });
  };

  const clearOutlineOwner = () => {
    outlineOwner = null;
    outlineSelect = null;
    store.setState((state) => ({ ...state, outline: emptyOutline() }));
  };

  return {
    store,
    activate(tabId) {
      if (disposed || tabId === activeTabId) return;
      activeTabId = tabId;
      clearFindOwner();
      clearOutlineOwner();
      store.setState((state) => ({ ...state, pendingAnchor: null }));
    },
    claimFind(tabId, owner, controller) {
      if (disposed || tabId !== activeTabId) return () => undefined;
      if (findOwner !== owner || findController !== controller) clearFindOwner();
      findOwner = owner;
      findController = controller;
      updateFind({ available: true });
      const { open, query } = store.getState().find;
      if (open && query) runQuery(true);
      return () => {
        if (findOwner !== owner) return;
        clearFindOwner();
      };
    },
    claimOutline(tabId, owner) {
      if (disposed || tabId !== activeTabId) return () => undefined;
      outlineOwner = owner;
      outlineSelect = null;
      store.setState((state) => ({
        ...state,
        outline: { activeId: null, available: true, headings: [] },
      }));
      return () => {
        if (outlineOwner !== owner) return;
        clearOutlineOwner();
      };
    },
    closeFind() {
      if (disposed) return;
      requestSequence += 1;
      findController?.close();
      updateFind({ current: 0, open: false, total: 0 });
    },
    consumeAnchor(tabId, id) {
      if (disposed) return;
      store.setState((state) =>
        state.pendingAnchor?.tabId === tabId && state.pendingAnchor.id === id
          ? { ...state, pendingAnchor: null }
          : state,
      );
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearFindOwner();
      clearOutlineOwner();
      activeTabId = null;
      store.setState((state) => ({ ...state, pendingAnchor: null }));
    },
    findNext() {
      if (!disposed && findController) applyMatch(findController.next());
    },
    findPrevious() {
      if (!disposed && findController) applyMatch(findController.previous());
    },
    openFind() {
      if (disposed || !findController) return false;
      const state = store.getState().find;
      updateFind({ focusRevision: state.focusRevision + 1, open: true });
      if (state.query) runQuery(true);
      return true;
    },
    publishOutline(tabId, owner, outline, select) {
      if (disposed || tabId !== activeTabId || outlineOwner !== owner) return;
      outlineSelect = select;
      store.setState((state) => ({
        ...state,
        outline: { ...outline, available: true },
      }));
    },
    requestAnchor(tabId, id) {
      if (disposed || tabId !== activeTabId || !id) return;
      store.setState((state) => ({ ...state, pendingAnchor: { id, tabId } }));
    },
    selectHeading(heading) {
      if (!disposed) outlineSelect?.(heading);
    },
    setFindCaseSensitive(value) {
      if (disposed) return;
      updateFind({ caseSensitive: value });
      runQuery(false);
    },
    setFindQuery(query) {
      if (disposed) return;
      updateFind({ query });
      runQuery(false);
    },
    setFindWholeWord(value) {
      if (disposed) return;
      updateFind({ wholeWord: value });
      runQuery(false);
    },
  };
}
