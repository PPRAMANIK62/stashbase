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

/**
 * The one place `tabs` and `activeTabId` move together.
 *
 * The active tab is always a member of `tabs` or null. Every transition below
 * states which ids it would like active, in order of preference, and the first
 * that names a member wins; nothing else may assign either field, so the
 * invariant cannot be broken one call site at a time.
 */
function withTabs(
  state: DocumentTabsState,
  tabs: DocumentTab[],
  intended: ReadonlyArray<string | null>,
): DocumentTabsState {
  const activeTabId =
    intended.find((id) => id !== null && tabs.some((tab) => tab.id === id)) ?? null;
  return state.tabs === tabs && state.activeTabId === activeTabId
    ? state
    : { ...state, activeTabId, tabs };
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
  return withTabs({ activeTabId: null, lifecycle: 'active', tabs: [] }, sources, [
    requestedActiveId,
    requestedActiveId === null ? null : (remappedIds.get(requestedActiveId) ?? null),
  ]);
}

export function openDocumentTab(state: DocumentTabsState, tab: DocumentTab): DocumentTabsState {
  if (state.lifecycle === 'disposed') return state;
  const existing = state.tabs.find((candidate) => sameSource(candidate.source, tab.source));
  if (existing) return withTabs(state, state.tabs, [existing.id]);
  return withTabs(state, [...state.tabs, { id: tab.id, source: { ...tab.source } }], [tab.id]);
}

export function activateDocumentTab(state: DocumentTabsState, tabId: string): DocumentTabsState {
  if (state.lifecycle === 'disposed') return state;
  return withTabs(state, state.tabs, [tabId, state.activeTabId]);
}

export function closeDocumentTab(state: DocumentTabsState, tabId: string): DocumentTabsState {
  if (state.lifecycle === 'disposed') return state;
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return state;
  const tabs = state.tabs.filter((tab) => tab.id !== tabId);
  const neighbour = tabs[Math.min(index, tabs.length - 1)]?.id ?? null;
  return withTabs(state, tabs, [state.activeTabId === tabId ? neighbour : state.activeTabId]);
}

export function disposeDocumentTabsState(state: DocumentTabsState): DocumentTabsState {
  return state.lifecycle === 'disposed' ? state : { ...state, lifecycle: 'disposed' };
}
