import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_SECTION = 'agents';

export function useSettingsCommand() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState(DEFAULT_SECTION);
  const focusToRestore = useRef<HTMLElement | null>(null);

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

  const openSettings = useCallback((next: string = DEFAULT_SECTION) => {
    focusToRestore.current =
      globalThis.document.activeElement instanceof HTMLElement
        ? globalThis.document.activeElement
        : null;
    setSection(next);
    setOpen(true);
  }, []);

  return { close, onSectionChange: setSection, open, openSettings, section };
}
