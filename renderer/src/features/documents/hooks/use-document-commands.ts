import { useEffect } from 'react';

import type { DocumentNavigationRuntime, DocumentTabsRuntime } from '@/features/documents/public';

/** Bind window-level document commands at the application composition boundary. */
export function useDocumentCommands(
  runtime: DocumentNavigationRuntime | null,
  tabs: DocumentTabsRuntime | null = null,
): void {
  useEffect(() => {
    if (!runtime) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const find = runtime.store.getState().find;
      if (event.key === 'Escape' && find.open) {
        event.preventDefault();
        runtime.closeFind();
        return;
      }
      if ((!event.metaKey && !event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'w' && !event.shiftKey) {
        // Cmd/Ctrl+W closes the active document tab. The chord is always
        // taken, so with nothing open it can never fall through to a
        // window close.
        event.preventDefault();
        const activeTabId = tabs?.store.getState().activeTabId;
        if (tabs && activeTabId) void tabs.close(activeTabId);
      } else if (key === 'f' && !event.shiftKey) {
        if (!runtime.openFind()) return;
        event.preventDefault();
      } else if (key === 'g' && find.open) {
        event.preventDefault();
        if (event.shiftKey) runtime.findPrevious();
        else runtime.findNext();
      }
    };
    globalThis.document.addEventListener('keydown', onKeyDown);
    return () => globalThis.document.removeEventListener('keydown', onKeyDown);
  }, [runtime, tabs]);
}
