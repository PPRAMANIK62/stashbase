/**
 * One subscription to the open-tab set, shared by the tab strip and the
 * document workspace.
 *
 * Both views need the same three answers and the same two commands. Reading
 * them here means the strip and the pane beneath it cannot disagree about
 * which tab is active on a frame, and neither view holds the store itself.
 */
import { useCallback } from 'react';
import { useStore } from 'zustand';

import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';

export function useDocumentTabs(runtime: DocumentTabsRuntime) {
  const activeTabId = useStore(runtime.store, (state) => state.activeTabId);
  const tabs = useStore(runtime.store, (state) => state.tabs);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  const activate = useCallback((tabId: string) => void runtime.activate(tabId), [runtime]);
  const close = useCallback((tabId: string) => void runtime.close(tabId), [runtime]);

  return { activate, activeTab, activeTabId, close, tabs };
}
