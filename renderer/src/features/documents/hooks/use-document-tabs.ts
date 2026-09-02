import { useCallback } from 'react';
import { useStore } from 'zustand';

import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';

export function useDocumentTabs(runtime: DocumentTabsRuntime) {
  const activeTabId = useStore(runtime.store, (state) => state.activeTabId);
  const tabs = useStore(runtime.store, (state) => state.tabs);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  const activate = useCallback((tabId: string) => runtime.activate(tabId), [runtime]);
  const close = useCallback((tabId: string) => runtime.close(tabId), [runtime]);

  return { activate, activeTab, activeTabId, close, tabs };
}
