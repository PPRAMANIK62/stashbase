import { useCallback, useEffect, useRef, useState } from 'react';

export interface CommandSurface {
  /** Closes the surface and returns focus to whatever opened it. */
  close(): void;
  open: boolean;
  /** Records the focused element, then opens. */
  present(): void;
}

/**
 * The open state of a keyboard-summoned overlay, plus the focus it owes back.
 *
 * A command surface is opened from a shortcut, so the element the user was on
 * is the element they expect to be on again when the surface closes. Restoring
 * it is deferred by a microtask because the overlay is still unmounting when
 * `close` runs, and a focus call into a node React is about to remove lands on
 * the body instead. Unmounting the holder restores focus too, so a surface torn
 * down by a scope change does not strand the caret.
 */
export function useCommandSurface(): CommandSurface {
  const [open, setOpen] = useState(false);
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

  const present = useCallback(() => {
    const active = globalThis.document.activeElement;
    focusToRestore.current = active instanceof HTMLElement ? active : null;
    setOpen(true);
  }, []);

  return { close, open, present };
}
