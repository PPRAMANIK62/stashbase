/**
 * How long a single click waits to find out it was not the first half of a
 * double click.
 *
 * Any surface where a second click means something else — rename a
 * conversation, type a zoom value — has to hold the single-click action back
 * for this long. One number for the whole app, because the reader has one pair
 * of hands: a window that answers a double click in the file list but misses
 * the same double click in a toolbar teaches nothing except that double
 * clicking is unreliable.
 *
 * Erring long. Sixty milliseconds of extra latency on a click is below what a
 * reader reads as lag, while a window that closes too early swallows the
 * second click and does the wrong thing instead.
 */
export const SINGLE_CLICK_DELAY_MS = 240;

/**
 * Whether the click that just landed on `element` was really a drag that
 * selected text inside it.
 *
 * A row whose text the reader can select is still a button, and Chromium
 * fires the row's click at the end of the drag that made the selection — so a
 * reader who drags across a project's path to copy it would also open the
 * project. The row asks this before it acts, and does nothing when the answer
 * is yes: the selection the reader just made is the whole of what they asked
 * for.
 *
 * Containment, not merely "a selection exists": a selection left behind in
 * another part of the window must not swallow an ordinary click here. A plain
 * click collapses the selection at its press, so it reaches this with nothing
 * selected and acts as usual.
 *
 * The selection is read through the element's own document rather than a
 * global, so this stays a function of what it was handed.
 */
export function holdsTextSelection(element: Element): boolean {
  const selection = element.ownerDocument.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  return element.contains(selection.getRangeAt(0).commonAncestorContainer);
}
