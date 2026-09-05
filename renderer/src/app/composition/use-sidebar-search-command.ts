import { useEffect } from 'react';

function isSearchShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'f' &&
    (event.metaKey || event.ctrlKey) &&
    event.shiftKey &&
    !event.altKey
  );
}

export function useSidebarSearchCommand(available: boolean, openSearch: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event)) return;
      event.preventDefault();
      if (available) openSearch();
    };
    globalThis.document.addEventListener('keydown', onKeyDown);
    return () => globalThis.document.removeEventListener('keydown', onKeyDown);
  }, [available, openSearch]);
}
