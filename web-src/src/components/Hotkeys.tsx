import { useEffect } from 'react';
import { useApp } from '../store/AppContext';

/**
 * Global keyboard shortcuts. Renderless — mounts a `keydown` listener
 * on document and dispatches into the store.
 *
 *   Cmd/Ctrl + N → new note
 *   Cmd/Ctrl + S → flush autosave immediately
 *   Cmd/Ctrl + O → focus the sidebar search (quick-switcher analog)
 *   Cmd/Ctrl + W → close the active tab
 *
 * `actions` is stable (memoised) and every handler is action-only — no
 * state reads inline — so the listener binds once and stays. Adding a
 * new shortcut here should not require any state plumbing.
 */
export function Hotkeys() {
  const { actions } = useApp();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'n') {
        e.preventDefault();
        void actions.newNote();
      } else if (k === 's') {
        e.preventDefault();
        void actions.flushSave();
      } else if (k === 'o') {
        e.preventDefault();
        actions.focusSearch();
      } else if (k === 'w') {
        // Swallow the chord even when no tab is open so the browser /
        // Electron doesn't close the window out from under us.
        e.preventDefault();
        void actions.closeActiveTab();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [actions]);
  return null;
}
