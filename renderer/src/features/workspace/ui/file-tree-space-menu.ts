import { useEffect, type RefObject } from 'react';

/** Sidebar regions and controls whose own right click never belongs to the tree. */
const FOREIGN_CONTEXT_MENU_OWNERS =
  '[data-sidebar="header"], [data-sidebar="footer"], button, a, input, textarea, [role="menu"], [role="dialog"], [role="tablist"]';

/**
 * The tree section ends with its last row, but the empty sidebar space below
 * it, down to the footer, still reads as the file tree. A right click there is
 * re-entered into the section's own context menu at the pointer, as long as
 * Files is showing and nothing else claims the spot.
 *
 * `listingKey` re-runs the subscription when the listing settles, because the
 * section element only exists from that point on.
 */
export function useTreeSpaceContextMenu(
  section: RefObject<HTMLElement | null>,
  listingKey: string,
): void {
  useEffect(() => {
    const element = section.current;
    const frame =
      element?.closest<HTMLElement>('[data-sidebar="sidebar"]') ??
      element?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!element || !frame) return;
    const forward = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (event.defaultPrevented || !(target instanceof Element)) return;
      if (element.contains(target) || element.closest('[hidden]')) return;
      if (target.closest(FOREIGN_CONTEXT_MENU_OWNERS)) return;
      if (event.clientY < element.getBoundingClientRect().bottom) return;
      event.preventDefault();
      element.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      );
    };
    frame.addEventListener('contextmenu', forward);
    return () => frame.removeEventListener('contextmenu', forward);
  }, [listingKey, section]);
}
