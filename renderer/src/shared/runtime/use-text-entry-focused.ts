import { useEffect, useState } from 'react';

/** Whether the focused element takes typed text. A rich composer is often a
 *  contenteditable host rather than a textarea, so both count. */
function textEntryElement(active: Element | null): boolean {
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) return true;
  return active?.getAttribute('contenteditable') === 'true';
}

/**
 * True while something the user can type into, inside a region matching
 * `selector`, holds focus.
 *
 * Focus is a document-wide fact: a field can be focused from anywhere, and the
 * region that cares about it is usually not the element that owns the field.
 * So this listens on the document rather than asking a caller to thread a ref
 * through every layer in between. `selector` names the region; the caller that
 * owns the region owns the marker it is found by.
 */
export function useTextEntryFocused(selector: string): boolean {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const update = () => {
      const active = document.activeElement;
      setFocused(active !== null && textEntryElement(active) && active.closest(selector) !== null);
    };
    update();
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, [selector]);

  return focused;
}
