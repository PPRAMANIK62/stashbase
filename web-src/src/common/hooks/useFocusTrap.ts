import { useEffect, useRef, type RefObject } from 'react';

/**
 * Real modality for the hand-rolled `role="dialog" aria-modal` overlays —
 * the palette pickers (Quick Open, library search, Link to file) and the
 * image lightbox — which deliberately do NOT ride Base UI's Dialog and so
 * get none of its focus management. `aria-modal="true"` is a promise to
 * assistive tech that the rest of the app is inert; without a trap, Tab
 * walks straight out into the chrome behind the veil.
 *
 * Attach the returned ref to the dialog panel. On mount the hook moves
 * focus inside (unless the overlay's own autofocus effect already did —
 * the pickers focus their query input themselves), keeps Tab and
 * Shift+Tab cycling within the panel's focusable controls, and on unmount
 * returns focus to the element that was focused when the overlay opened.
 * The restore is skipped when something else has already claimed focus
 * outside the panel — accepting a picker row hands focus to the opened
 * document, and the trap must not steal it back.
 *
 * The Tab listener sits on `document` in the capture phase so it wins even
 * when focus has landed on the veil or been lost to `body`; keys other
 * than Tab pass through untouched, so each overlay's own Escape/Arrow
 * handling is unaffected.
 */

/** The controls these overlays actually render; `tabindex="-1"` holders
 *  (the panels themselves) are focus targets, not tab stops. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap<T extends HTMLElement>(): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  // Captured at first render — before any mount effect (this one or the
  // overlay's own input autofocus) has moved focus into the panel.
  const returnFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    // Copied out of the ref inside the effect: the opener element is fixed
    // for the overlay's whole life, and the cleanup must not read a ref
    // `.current` that lint cannot prove still holds it.
    const previous = returnFocusRef.current;
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    if (!container.contains(document.activeElement)) {
      // A panel carrying its own tabindex asked to hold focus itself (the
      // lightbox, where focusing a control would spotlight an arbitrary
      // button); otherwise the first control takes it.
      const initial = container.hasAttribute('tabindex') ? container : focusables()[0] ?? container;
      initial.focus({ preventScroll: true });
    }

    // Arrow, not a hoisted declaration: TypeScript only carries the null
    // narrowing on `container` into closures created after the guard.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!(current instanceof HTMLElement) || !container.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (
        previous?.isConnected
        && (container.contains(document.activeElement) || document.activeElement === document.body)
      ) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  return containerRef;
}
