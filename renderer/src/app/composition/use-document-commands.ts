import { useEffect } from 'react';

import type { DocumentNavigationRuntime } from '@/features/documents/public';

/** Bind window-level document commands at the application composition boundary. */
export function useDocumentCommands(runtime: DocumentNavigationRuntime | null): void {
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
      if (key === 'f' && !event.shiftKey) {
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
  }, [runtime]);
}
