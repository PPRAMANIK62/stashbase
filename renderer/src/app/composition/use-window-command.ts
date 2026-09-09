import { useEffect } from 'react';

/**
 * One window-level chord, bound for as long as the caller is mounted.
 *
 * The two shortcut hooks beside this one had the same listener written out
 * twice; what differs between a chord is only which event it recognises and
 * what it then does. Both halves must be stable — a module-level predicate and
 * a memoised action — so the listener is installed once rather than on every
 * render.
 */
export function useWindowCommand(
  matches: (event: KeyboardEvent) => boolean,
  run: () => void,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matches(event)) return;
      event.preventDefault();
      run();
    };
    globalThis.document.addEventListener('keydown', onKeyDown);
    return () => globalThis.document.removeEventListener('keydown', onKeyDown);
  }, [matches, run]);
}
