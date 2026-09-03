import { useMemo, useRef } from 'react';
import type { MenuProps } from '@/common/components/Menu';
import { renderMenuItems } from '@/common/components/menuItemRows';
import {
  Menu as MenuRoot,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
} from '@/common/components/ui/menu';

export default function ManagedMenu({
  anchor,
  items,
  pinnedItems,
  onClose,
  minWidth,
}: MenuProps) {
  const finalFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const returnFocusRef = useRef(true);
  const virtualAnchor = useMemo(
    () => ({
      getBoundingClientRect: () => (
        'rect' in anchor
          ? anchor.rect
          : new DOMRect(anchor.x, anchor.y, 0, 0)
      ),
    }),
    [anchor],
  );
  const pointAnchor = 'x' in anchor;
  const align = 'rect' in anchor && anchor.align === 'right' ? 'end' : 'start';

  return (
    <MenuRoot
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <MenuPortal>
        <MenuPositioner
          anchor={virtualAnchor}
          positionMethod="fixed"
          side="bottom"
          align={align}
          sideOffset={pointAnchor ? 0 : 4}
          collisionPadding={6}
        >
          <MenuPopup
            finalFocus={() => returnFocusRef.current ? finalFocusRef.current : false}
            /* Cap the popup both ways: a long untruncatable detail (an
             * absolute path outside the home dir) truncates against the
             * width bound, and a long list (the folder switcher on a big
             * library) scrolls INSIDE the card instead of running the
             * viewport. Only the body scrolls: `pinnedItems` (the
             * switcher's add-folder actions, ending in the one hairline)
             * stay put above it, so the escape-hatch actions never
             * scroll away and the hairline reads as the scroll edge. */
            className="flex max-h-overlay-md max-w-overlay-md flex-col"
            style={{ minWidth }}
          >
            {pinnedItems && pinnedItems.length > 0 && (
              <div className="flex-none">{renderMenuItems(pinnedItems, returnFocusRef)}</div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-quiet">
              {renderMenuItems(items, returnFocusRef)}
            </div>
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </MenuRoot>
  );
}
