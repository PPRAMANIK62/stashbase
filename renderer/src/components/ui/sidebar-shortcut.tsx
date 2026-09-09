/** The sidebar's bare-key toggle shortcut: the default keys, the rule that
 *  picks which mounted provider answers a keypress, and the chip that shows
 *  the key inside a tooltip.
 *
 *  The listener has to be global — the key should work without focus inside
 *  the sidebar — but only ONE provider may answer it, so every mounted
 *  provider root registers itself here and the resolution below decides the
 *  winner from DOM containment (never mount order: a persistent app-shell
 *  provider mounts once while demos mount later on navigation). */

'use client';

import { useEffect, type ReactNode, type RefObject } from 'react';

import { Kbd } from '@/components/internal/kbd';

/** Bare-key toggle defaults: "[" for a left sidebar, "]" for a right one.
 *  Bare (no ⌘/Ctrl) so the browser's history shortcuts stay untouched. */
export const SIDEBAR_KEYBOARD_SHORTCUT = '[';
export const SIDEBAR_KEYBOARD_SHORTCUT_RIGHT = ']';

// Mounted-provider registry for the global toggle shortcut. Only the
// innermost provider containing focus answers — or, when focus is outside
// every provider, the OUTERMOST mounted one (the app-shell provider that
// wraps everything else). Same pattern as AskUserQuestions' 1-9 shortcuts.
const mountedProviders: HTMLElement[] = [];

/** True when `root` is the provider that owns this keypress. */
function answersKeypress(root: HTMLElement, target: HTMLElement): boolean {
  // Providers can NEST (an app shell wrapping doc previews), so containment
  // alone isn't enough: the innermost provider containing focus wins.
  if (root.contains(target)) {
    if (mountedProviders.some((el) => el !== root && root.contains(el) && el.contains(target))) {
      return false;
    }
    // The focused element itself WRAPS another provider (a docs preview frame
    // holding keyboard scope for the demo inside it — see click-to-focus):
    // the wrapped provider answers, not this ancestor shell.
    return !mountedProviders.some((el) => el !== root && target.contains(el));
  }

  // Focus outside this provider. A focused element that WRAPS providers — a
  // docs preview frame holding keyboard scope for the demo inside it — scopes
  // the key to what it wraps: the outermost wrapped provider answers, and this
  // check must come BEFORE the containment guard below (an app-shell provider
  // always contains the preview frame, and must not steal the key from the
  // demo the frame scopes to). Focus on <body> wraps every provider, which
  // degenerates to the original rule: the OUTERMOST provider overall answers.
  const wrapped = mountedProviders.filter((el) => target.contains(el));
  if (wrapped.length > 0) {
    const outermost = wrapped.find(
      (el) => !wrapped.some((other) => other !== el && other.contains(el)),
    );
    return outermost === root;
  }
  if (mountedProviders.some((el) => el !== root && el.contains(target))) return false;
  const outermost = mountedProviders.find(
    (el) => !mountedProviders.some((other) => other !== el && other.contains(el)),
  );
  return outermost === root;
}

/** Registers a provider root in the shared registry and binds the bare toggle
 *  key to it. Bound to the provider's lifetime (not a docs-only global),
 *  skipped while typing, and skipped when a modifier is held so ⌘[ / ⌘] keep
 *  their browser meaning. `shortcut: null` disables the binding but keeps the
 *  provider registered, so a nested one still resolves correctly. */
export function useSidebarToggleShortcut(
  rootRef: RefObject<HTMLElement | null>,
  shortcut: string | null,
  toggleSidebar: () => void,
): void {
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    mountedProviders.push(el);
    return () => {
      const i = mountedProviders.indexOf(el);
      if (i !== -1) mountedProviders.splice(i, 1);
    };
  }, [rootRef]);

  useEffect(() => {
    if (shortcut == null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== shortcut.toLowerCase()) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
        return;
      const root = rootRef.current;
      if (!root) return;
      if (!answersKeypress(root, target)) return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rootRef, shortcut, toggleSidebar]);
}

/** Keystroke chip rendered inside the (inverted) tooltip surface. */
export function ShortcutKbd({ children }: { children: ReactNode }) {
  return (
    <Kbd className="-my-1 min-w-4" size="compact" variant="inverted">
      {children}
    </Kbd>
  );
}
