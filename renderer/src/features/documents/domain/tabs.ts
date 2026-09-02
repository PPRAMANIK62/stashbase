import type { SourceReference } from '@/shared/domain/source-reference';

import { sameSource } from './document';

export interface DocumentTab {
  id: string;
  source: SourceReference;
}

export interface DocumentTabsState {
  activeTabId: string | null;
  lifecycle: 'active' | 'disposed';
  tabs: DocumentTab[];
}

export interface RestoredDocumentTabs {
  activeTabId: string | null;
  tabs: DocumentTab[];
}

export function createDocumentTabsState(
  restored: RestoredDocumentTabs | null = null,
): DocumentTabsState {
  const ids = new Set<string>();
  const sources: DocumentTab[] = [];
  const remappedIds = new Map<string, string>();

  for (const tab of restored?.tabs ?? []) {
    const matchingSource = sources.find((candidate) => sameSource(candidate.source, tab.source));
    if (matchingSource) {
      remappedIds.set(tab.id, matchingSource.id);
      continue;
    }
    if (ids.has(tab.id)) continue;
    ids.add(tab.id);
    sources.push({ id: tab.id, source: { ...tab.source } });
  }

  const requestedActiveId = restored?.activeTabId ?? null;
  const activeTabId = requestedActiveId
    ? (sources.find((tab) => tab.id === requestedActiveId)?.id ??
      remappedIds.get(requestedActiveId) ??
      null)
    : null;

  return { activeTabId, lifecycle: 'active', tabs: sources };
}

export function openDocumentTab(state: DocumentTabsState, tab: DocumentTab): DocumentTabsState {
  if (state.lifecycle === 'disposed') return state;
  const existing = state.tabs.find((candidate) => sameSource(candidate.source, tab.source));
  if (existing) {
    return state.activeTabId === existing.id ? state : { ...state, activeTabId: existing.id };
  }
  return {
    ...state,
    activeTabId: tab.id,
    tabs: [...state.tabs, { id: tab.id, source: { ...tab.source } }],
  };
}

export function activateDocumentTab(state: DocumentTabsState, tabId: string): DocumentTabsState {
  if (
    state.lifecycle === 'disposed' ||
    state.activeTabId === tabId ||
    !state.tabs.some((tab) => tab.id === tabId)
  ) {
    return state;
  }
  return { ...state, activeTabId: tabId };
}

export function closeDocumentTab(state: DocumentTabsState, tabId: string): DocumentTabsState {
  if (state.lifecycle === 'disposed') return state;
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return state;
  const tabs = state.tabs.filter((tab) => tab.id !== tabId);
  const activeTabId =
    state.activeTabId === tabId
      ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null)
      : state.activeTabId;
  return { ...state, activeTabId, tabs };
}

export function disposeDocumentTabsState(state: DocumentTabsState): DocumentTabsState {
  return state.lifecycle === 'disposed' ? state : { ...state, lifecycle: 'disposed' };
}
