import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

function isQuickOpenShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'p' &&
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function useQuickOpenCommand(scopeKey: string | null) {
  const [open, setOpen] = useState(false);
  const focusToRestore = useRef<HTMLElement | null>(null);
  const previousScopeKey = useRef(scopeKey);

  const restoreFocus = useCallback(() => {
    const target = focusToRestore.current;
    focusToRestore.current = null;
    queueMicrotask(() => {
      if (target?.isConnected) target.focus();
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    restoreFocus();
  }, [restoreFocus]);

  useEffect(() => restoreFocus, [restoreFocus]);

  useLayoutEffect(() => {
    if (previousScopeKey.current === scopeKey) return;
    previousScopeKey.current = scopeKey;
    close();
  }, [close, scopeKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isQuickOpenShortcut(event)) return;
      event.preventDefault();
      if (!scopeKey || open || globalThis.document.querySelector('[role="dialog"]')) return;
      focusToRestore.current =
        globalThis.document.activeElement instanceof HTMLElement
          ? globalThis.document.activeElement
          : null;
      setOpen(true);
    };

    globalThis.document.addEventListener('keydown', onKeyDown);
    return () => globalThis.document.removeEventListener('keydown', onKeyDown);
  }, [open, scopeKey]);

  return { close, open };
}
