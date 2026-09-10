/** SelectContent — the portalled popup surface of a Select.
 *
 *  Portal > Positioner > Popup carrying an Elevated surface plus the shared
 *  row overlays and pointer/focus wiring from `./dropdown-surface`. What is
 *  particular to a Select and not to a Dropdown lives here: the popup keeps
 *  its rows registered while it sits hidden between opens, so it re-measures
 *  per open and tears its overlays down as the close begins. */
'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
import { motion } from 'framer-motion';
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import { Elevated } from '@/components/ui/elevated';
import { mergeRefs } from '@/lib/merge-refs';
import { useShape } from '@/lib/shape-context';
import {
  useDomOrderRegistry,
  useMarkedIndex,
  type DomOrderRegistry,
} from '@/lib/use-dom-order-registry';
import { cn } from '@/lib/utils';

import {
  MenuSurfaceOverlays,
  overlayRects,
  useMenuSurface,
  usePopupMotion,
} from './dropdown-surface';
import { useSelectContext } from './select-root';

/** What a SelectItem needs from the popup around it: the registry that gives
 *  it its position, where to publish its measured element, and which row the
 *  pointer is on. */
interface SelectContentContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void;
  activeIndex: number | null;
  /** Rows derive their index — and publish their checked state — here. */
  itemRegistry: DomOrderRegistry;
}

const SelectContentContext = createContext<SelectContentContextValue | null>(null);

export function useSelectContent(): SelectContentContextValue {
  const ctx = useContext(SelectContentContext);
  if (!ctx) throw new Error('SelectItem must be used within a SelectContent');
  return ctx;
}

interface SelectContentProps {
  className?: string;
  children: ReactNode;
}

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children }, ref) => {
    const { open, releaseOnExit } = useSelectContext();
    const shape = useShape();
    const containerRef = useRef<HTMLDivElement>(null);

    const surface = useMenuSurface(containerRef, { clearFocusRingOnPointerEnter: true });
    const { activeIndex, registerItem, remeasure, sessionRef, setActiveIndex, setFocusedIndex } =
      surface;

    const popupMotion = usePopupMotion({ open });
    const itemRegistry = useDomOrderRegistry();
    // The checked row marks itself against the value (see SelectItem), so the
    // popup neither scans the DOM for it nor holds a copy that can lag a pick
    // behind the value that caused it. Rows do not move on a pick, so the
    // published rects stay trustworthy and only this index switches — which is
    // what lets the selected marker spring from the old row to the new one.
    const checkedIndex = useMarkedIndex(itemRegistry);

    // Fresh rects once per open. Measuring is the hook's job — it owns the
    // one coalesced pass that item registration and container resizes both
    // feed into, and a second pass from elsewhere is what used to land a
    // corrected rect on an already-mounted overlay. The popup keeps its items
    // registered while it sits hidden between opens, so registration alone
    // would never trigger a fresh pass on reopen.
    useEffect(() => {
      if (!open) return;
      remeasure();
    }, [open, remeasure]);

    // Reset the pointer and focus indices as the close begins. Base UI keeps
    // the popup mounted through the exit tween, so a leftover activeIndex
    // would leave the hover pill sitting on the previously active row on
    // reopen, springing from there to the row that auto-focus lands on.
    useEffect(() => {
      if (open) return;
      setActiveIndex(null);
      setFocusedIndex(null);
    }, [open, setActiveIndex, setFocusedIndex]);

    // Settled-only: this popup keeps its rows registered while it sits hidden
    // between opens, so an overlay positioned from an incomplete pass would
    // mount on the wrong row and spring across the list when the correcting
    // pass lands.
    const { activeRect, checkedRect, focusRect } = overlayRects(surface, checkedIndex, {
      settledOnly: true,
    });

    const contentCtx = useMemo(
      () => ({ registerItem, activeIndex, itemRegistry }),
      [registerItem, activeIndex, itemRegistry],
    );

    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          alignItemWithTrigger={false}
          className="z-50 outline-none"
        >
          <motion.div {...popupMotion} onAnimationComplete={releaseOnExit}>
            <SelectContentContext.Provider value={contentCtx}>
              <SelectPrimitive.Popup
                render={<Elevated offset={2} shadowLevel={3} ref={mergeRefs(containerRef, ref)} />}
                {...surface.surfaceProps}
                className={cn(
                  // min-w tracks the trigger via the Positioner's --anchor-width
                  // var, matching the pre-migration minWidth: triggerRect.width.
                  `relative flex max-h-[min(300px,var(--available-height))] min-w-[var(--anchor-width)] flex-col gap-0.5 overflow-y-auto ${shape.container} p-1 outline-none select-none`,
                  className,
                )}
              >
                <MenuSurfaceOverlays
                  activeRect={activeRect ?? null}
                  checkedRect={checkedRect ?? null}
                  focusRect={focusRect ?? null}
                  hoverSession={sessionRef.current}
                  mounted={open}
                />

                {children}
              </SelectPrimitive.Popup>
            </SelectContentContext.Provider>
          </motion.div>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    );
  },
);

SelectContent.displayName = 'SelectContent';

export { SelectContent };
