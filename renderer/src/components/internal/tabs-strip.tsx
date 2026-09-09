/** The machinery both tab strips run on. A horizontal strip of tabs is three
 *  things beyond its buttons: a measurement of where each tab sits, a set of
 *  pointer/focus handlers that decide which tab the strip is pointing at, and
 *  three absolutely-positioned layers that spring between those measured boxes
 *  (the selected pill, the transient hover pill, the focus ring).
 *
 *  `useTabsStrip` owns the first two and `TabsStripIndicators` draws the third;
 *  `TabsStripLabel` is the stacked ghost-span label a tab renders. What differs
 *  between the segmented `Tabs` and the borderless `TabsSubtle` is only the
 *  pill tint and how each resolves its selected index, so both arrive as props.
 *  Neither strip should reimplement any of this. */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type Ref,
  type RefCallback,
  type RefObject,
} from 'react';

import { WeightedLabel } from '@/components/ui/weighted-label';
import { FOCUS_RING_BORDER } from '@/lib/focus-ring';
import { mergeRefs } from '@/lib/merge-refs';
import { outsetBox, overlayBox } from '@/lib/proximity-geometry';
import { useShape } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import { exitTween, spring, tween } from '@/lib/springs';
import { useMeasuredSize } from '@/lib/use-measured-size';
import { useMotionTier } from '@/lib/use-motion-tier';
import { useProximityHover, type ItemRect } from '@/lib/use-proximity-hover';
import { cn } from '@/lib/utils';

/* ─────────────────────── useTabsStrip ─────────────────────── */

interface TabsStrip {
  /** The tab nearest the cursor (or holding focus), or null. */
  hoveredIndex: number | null;
  /** The tab holding *visible* focus, or null — the focus ring's target. */
  focusedIndex: number | null;
  itemRects: ItemRect[];
  registerItem: (index: number, element: HTMLElement | null) => void;
  measureItems: () => void;
  /** Hand to the tablist element: the strip's measurement handle merged with
   *  the caller's forwarded ref. The strip measures against this element, so
   *  it owns the handle rather than borrowing one from every caller. */
  listRef: RefCallback<HTMLDivElement>;
  /** Whether the pointer is over the strip. The hover pill reads it on the
   *  way out: leaving by mouse retracts the pill into the selected tab, while
   *  losing it to a keyboard move just fades it where it stands. */
  isPointerInside: RefObject<boolean>;
  /** Spread onto the tablist element, ahead of the caller's own props so a
   *  consumer can still override any one of them. */
  listHandlers: {
    onMouseMove: (event: MouseEvent) => void;
    onMouseLeave: () => void;
    onFocus: (event: FocusEvent<HTMLDivElement>) => void;
    onBlur: (event: FocusEvent<HTMLDivElement>) => void;
  };
}

/**
 * Measures a horizontal tab strip and tracks what it is pointing at.
 *
 * @param tabSelector how an incoming focus event finds the tab it landed in —
 *   `[role="tab"]` where the primitive owns the role, or
 *   `[data-proximity-index]` where the index attribute is the marker.
 * @param forwardedRef the tablist ref the strip's own handle is merged with.
 */
export function useTabsStrip(
  tabSelector: string,
  forwardedRef: Ref<HTMLDivElement> | undefined,
): TabsStrip {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPointerInside = useRef(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const {
    activeIndex: hoveredIndex,
    setActiveIndex: setHoveredIndex,
    itemRects,
    handlers,
    registerItem,
    measureItems,
  } = useProximityHover(containerRef, { axis: 'x' });

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      isPointerInside.current = true;
      handlers.onMouseMove(event);
    },
    [handlers],
  );

  const onMouseLeave = useCallback(() => {
    isPointerInside.current = false;
    handlers.onMouseLeave();
  }, [handlers]);

  const onFocus = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const indexAttr = target.closest(tabSelector)?.getAttribute('data-proximity-index');
      if (indexAttr == null) return;
      const idx = Number(indexAttr);
      setHoveredIndex(idx);
      // Only a keyboard arrival draws the ring; a click focuses too.
      setFocusedIndex(target.matches(':focus-visible') ? idx : null);
    },
    [setHoveredIndex, tabSelector],
  );

  const onBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (containerRef.current?.contains(event.relatedTarget as Node)) return;
      setFocusedIndex(null);
      if (isPointerInside.current) return;
      setHoveredIndex(null);
    },
    [containerRef, setHoveredIndex],
  );

  const listHandlers = useMemo(
    () => ({ onMouseMove, onMouseLeave, onFocus, onBlur }),
    [onMouseMove, onMouseLeave, onFocus, onBlur],
  );

  return {
    hoveredIndex,
    focusedIndex,
    itemRects,
    registerItem,
    measureItems,
    isPointerInside,
    listHandlers,
    listRef: mergeRefs(containerRef, forwardedRef),
  };
}

/* ─────────────────────── TabsStripIndicators ─────────────────────── */

interface TabsStripIndicatorsProps {
  strip: TabsStrip;
  /** Where the selected pill rests, or null while nothing is selected. */
  selectedIndex: number | null;
  /** Tint for the always-mounted selected pill. */
  selectedSurface: string;
  /** Opacity the selected pill drops to while a different tab is hovered. */
  selectedHoverOpacity: number;
  /** Tint for the transient hover pill. */
  hoverSurface: string;
}

/**
 * The three layers that sit behind a strip's tabs, in paint order: the
 * selected pill (always mounted, springs between tabs), the hover pill (mounts
 * out of the selected pill and retracts into it), and the focus ring. Renders
 * a fragment, so a strip drops it in as a direct child of its tablist.
 */
export function TabsStripIndicators({
  strip,
  selectedIndex,
  selectedSurface,
  selectedHoverOpacity,
  hoverSurface,
}: TabsStripIndicatorsProps) {
  const shape = useShape();
  const { hoveredIndex, focusedIndex, itemRects, isPointerInside } = strip;

  const selectedRect = selectedIndex !== null ? itemRects[selectedIndex] : undefined;
  const hoverRect = hoveredIndex !== null ? itemRects[hoveredIndex] : undefined;
  const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : undefined;
  const isHoveringSelected = hoveredIndex === selectedIndex;
  const isHovering = hoveredIndex !== null && !isHoveringSelected;
  const settle = useMotionTier({ ...spring.fast, opacity: tween.fast });
  const glide = useMotionTier({ ...spring.moderate, opacity: tween.fast });
  const retract = useMotionTier({ ...spring.moderate, opacity: exitTween.fast });
  const fadeOut = useMotionTier(spring.fast.exit);

  return (
    <>
      {/* Selected pill */}
      {selectedRect && (
        <motion.div
          className={cn('pointer-events-none absolute', selectedSurface, shape.bg)}
          initial={false}
          animate={{ ...overlayBox(selectedRect), opacity: isHovering ? selectedHoverOpacity : 1 }}
          transition={glide}
        />
      )}

      {/* Hover pill */}
      <AnimatePresence>
        {hoverRect && !isHoveringSelected && selectedRect && (
          <motion.div
            className={cn('pointer-events-none absolute', hoverSurface, shape.bg)}
            initial={{ ...overlayBox(selectedRect), opacity: 0 }}
            animate={{ ...overlayBox(hoverRect), opacity: 0.4 }}
            exit={
              isPointerInside.current
                ? { opacity: 0, transition: fadeOut }
                : { ...overlayBox(selectedRect), opacity: 0, transition: retract }
            }
            transition={settle}
          />
        )}
      </AnimatePresence>

      {/* Focus ring */}
      <AnimatePresence>
        {focusRect && (
          <motion.div
            className={cn(
              'pointer-events-none absolute z-20 border',
              FOCUS_RING_BORDER,
              shape.focusRing,
            )}
            initial={false}
            animate={outsetBox(focusRect, 2)}
            exit={{ opacity: 0, transition: fadeOut }}
            transition={settle}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─────────────────────── TabsStripLabel ─────────────────────── */

interface TabsStripLabelProps {
  label: string;
  /** Selected, or nearest the cursor — glyph and label darken together. */
  isActive: boolean;
  /** Selected. Only the selection bolds the label; hover does not. */
  isSelected: boolean;
  /** Observed by a strip that animates a collapsing label to a measured
   *  layout width rather than handing framer "auto". */
  measureRef?: Ref<HTMLSpanElement>;
}

/** A tab's label — the shared weight-reserving label at the strip's step. */
export function TabsStripLabel({ label, isActive, isSelected, measureRef }: TabsStripLabelProps) {
  const sizeClasses = useSize();
  return (
    <WeightedLabel
      className={sizeClasses.text}
      emphasized={isSelected}
      lit={isActive}
      overflow="nowrap"
      ref={measureRef}
    >
      {label}
    </WeightedLabel>
  );
}

/* ─────────────────────── TabsStripCollapsingLabel ─────────────────────── */

/**
 * A tab label that collapses away when the tab is not the one showing it —
 * the borderless strip's icon-only mode, where only the selected tab keeps
 * its word.
 *
 * The width it travels to is MEASURED, never "auto": framer resolves an
 * "auto" target from the element's *visual* (transformed) size, so under a
 * scaled ancestor the spring overshoots to scale × the real width and snaps
 * when "auto" lands. The shared measurement hook is transform-immune and owns
 * the observer's lifetime — the same setup as the accordions' height.
 */
export function TabsStripCollapsingLabel({
  isActive,
  isSelected,
  label,
  show,
}: Omit<TabsStripLabelProps, 'measureRef'> & {
  /** Whether the label is showing. It travels in and out from zero width. */
  show: boolean;
}) {
  const sizeClasses = useSize();
  const measured = useMeasuredSize<HTMLSpanElement>({ axis: 'width' });
  const width = measured.size;
  const transition = useMotionTier({ ...spring.fast, opacity: exitTween.fast });

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          key="label"
          className="overflow-hidden"
          // Until the measurement lands, let CSS resolve the width instead of
          // handing framer "auto" (see above): plain CSS auto is the true
          // layout width, and the measured number that follows matches it.
          style={width == null ? { width: 'auto' } : {}}
          initial={{ width: 0, opacity: 0, marginLeft: 0 }}
          animate={{
            ...(width != null ? { width } : null),
            opacity: 1,
            // Matches the ladder's icon-to-label gap (gap-2 / gap-1.5).
            marginLeft: sizeClasses.variant === 'compact' ? 6 : 8,
          }}
          exit={{ width: 0, opacity: 0, marginLeft: 0 }}
          transition={transition}
        >
          <TabsStripLabel
            label={label}
            isActive={isActive}
            isSelected={isSelected}
            measureRef={measured.ref}
          />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
