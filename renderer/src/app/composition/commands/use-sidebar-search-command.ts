import { useCallback } from 'react';

import { useWindowCommand } from './use-window-command';

function isSearchShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'f' &&
    (event.metaKey || event.ctrlKey) &&
    event.shiftKey &&
    !event.altKey
  );
}

/** Cmd/Ctrl+Shift+F opens the sidebar's search panel. The chord is always
 *  taken, so it never falls through to the browser's own find. */
export function useSidebarSearchCommand(available: boolean, openSearch: () => void) {
  useWindowCommand(
    isSearchShortcut,
    useCallback(() => {
      if (available) openSearch();
    }, [available, openSearch]),
  );
}
