import { useEffect } from 'react';

import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';

/** The Documents keyboard contract: Cmd/Ctrl+W closes the active tab, Cmd/Ctrl+F
 *  opens Find, Cmd/Ctrl+G steps through it, Escape closes it. It lives with the
 *  feature that owns those verbs rather than in the shell, and every chord asks
 *  the runtime to act and reads back whether it did, so nothing inspects
 *  document state to decide. */
export function useDocumentCommands(
  runtime: DocumentNavigationRuntime | null,
  tabs: DocumentTabsRuntime | null = null,
  options: { enabled?: boolean; newTab?: { open: boolean; close(): void } } = {},
): void {
  const { enabled = true, newTab } = options;
  useEffect(() => {
    if (!runtime || !enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[role="dialog"], [role="alertdialog"], [data-command-surface="agent"]'))
        return;
      if (newTab?.open) {
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          !event.shiftKey &&
          event.key.toLowerCase() === 'w'
        ) {
          event.preventDefault();
          newTab.close();
        }
        return;
      }
      if (event.key === 'Escape') {
        if (runtime.closeFind()) event.preventDefault();
        return;
      }
      if ((!event.metaKey && !event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'w' && !event.shiftKey) {
        // Cmd/Ctrl+W closes the active document tab. The chord is always
        // taken, so with nothing open it can never fall through to a
        // window close.
        event.preventDefault();
        void tabs?.closeActive();
      } else if (key === 'f' && !event.shiftKey) {
        if (!runtime.openFind()) return;
        event.preventDefault();
      } else if (key === 'g') {
        if (event.shiftKey ? runtime.findPrevious() : runtime.findNext()) event.preventDefault();
      }
    };
    globalThis.document.addEventListener('keydown', onKeyDown);
    return () => globalThis.document.removeEventListener('keydown', onKeyDown);
  }, [enabled, newTab, runtime, tabs]);
}
