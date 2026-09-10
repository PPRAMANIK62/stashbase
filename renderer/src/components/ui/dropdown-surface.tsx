/**
 * The menu surface — everything a list of selectable rows needs that is not a
 * row and not a primitive.
 *
 * Three surfaces in this kit are the same surface: the inline Dropdown panel,
 * the Dropdown popup, and the Select popup. Each portals through a different
 * Base UI primitive and holds a different kind of row, but all three draw the
 * same three absolutely positioned overlays (the row under the pointer, the
 * selected row, the keyboard-focused row), keep those overlays in step with
 * `useProximityHover` through the same pointer and focus wiring, and open and
 * close on the same spring. That shared half lives here once:
 *
 *   - `MenuSurfaceOverlays` — the three overlays and their motion tiers;
 *   - `useMenuSurface` — proximity measurement plus focus-ring bookkeeping,
 *     returning the DOM props the surface element spreads;
 *   - `popupMotion` — the open/close transition of a portalled popup.
 *
 * Nothing here renders a row or names a primitive. Rows come from MenuItem
 * and SelectItem, which register themselves with the proximity hook this
 * module hands back.
 */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  useState,
  type Dispatch,
  type FocusEvent,
  type RefObject,
  type SetStateAction,
} from 'react';

import { FOCUS_RING_BORDER } from '@/lib/focus-ring';
import { outsetBox, overlayBox, type OverlayBox } from '@/lib/proximity-geometry';
import { useShape } from '@/lib/shape-context';
import { spring, tween } from '@/lib/springs';
import { useMotionTier } from '@/lib/use-motion-tier';
import { useProximityHover, type ItemRect } from '@/lib/use-proximity-hover';

// ---------------------------------------------------------------------------
// Row overlays
// ---------------------------------------------------------------------------

/** The movement tiers an overlay rides. Each carries its own `.exit`. */
type OverlayTier = typeof spring.fast | typeof spring.moderate;

interface RowOverlayProps {
  className: string;
  /** Where the overlay settles. */
  to: OverlayBox & { opacity?: number };
  /** Where it enters from; `false` mounts it already at `to`. */
  from: (OverlayBox & { opacity: number }) | false;
  /** Movement tier for the box; its `.exit` carries the fade out. */
  tier: OverlayTier;
}

/** One absolutely positioned overlay tracking one row. The three overlays a
 *  surface draws differ only in their class, their tier, and whether they
 *  animate in — so they are one component with three call sites below. */
function RowOverlay({ className, from, tier, to }: RowOverlayProps) {
  const settle = useMotionTier({ ...tier, opacity: tween.fast });
  const fadeOut = useMotionTier(tier.exit);
  return (
    <motion.div
      animate={to}
      className={className}
      exit={{ opacity: 0, transition: fadeOut }}
      initial={from}
      transition={settle}
    />
  );
}

interface MenuSurfaceOverlaysProps {
  /** The row under the pointer, or null. */
  activeRect: ItemRect | null;
  /** The selected row, or null when nothing is selected or the surface
   *  suppresses the selection fill. */
  checkedRect: ItemRect | null;
  /** The keyboard-focused row, or null. */
  focusRect: ItemRect | null;
  /** `sessionRef.current` from `useProximityHover`. Keying the hover overlay
   *  on it replays the entry once per pointer session instead of once per
   *  row. */
  hoverSession: number;
  /** Where the hover overlay grows from on its first frame. Defaults to the
   *  row it is entering on; the dropdown surfaces pass the selected row so
   *  the hover pill reads as detaching from the current choice. */
  hoverOrigin?: ItemRect | null;
  /** False tears the overlays down outright instead of exit-animating them.
   *  A popup that stays mounted between opens needs that: an overlay
   *  AnimatePresence re-adopts under its old key never replays `initial`, so
   *  it would reopen sitting on the row it left and spring across the list.
   *  @default true */
  mounted?: boolean;
}

/** The selected, hover, and focus overlays of one menu surface. */
export function MenuSurfaceOverlays({
  activeRect,
  checkedRect,
  focusRect,
  hoverOrigin,
  hoverSession,
  mounted = true,
}: MenuSurfaceOverlaysProps) {
  const shape = useShape();
  if (!mounted) return null;

  return (
    <>
      {/* Selected background */}
      <AnimatePresence>
        {checkedRect && (
          <RowOverlay
            className={`absolute ${shape.bg} pointer-events-none bg-active`}
            from={false}
            tier={spring.moderate}
            to={{ ...overlayBox(checkedRect), opacity: 1 }}
          />
        )}
      </AnimatePresence>

      {/* Hover background */}
      <AnimatePresence>
        {activeRect && (
          <RowOverlay
            className={`absolute ${shape.bg} pointer-events-none bg-hover`}
            from={{ opacity: 0, ...overlayBox(hoverOrigin ?? activeRect) }}
            key={hoverSession}
            tier={spring.fast}
            to={{ ...overlayBox(activeRect), opacity: 1 }}
          />
        )}
      </AnimatePresence>

      {/* Focus ring */}
      <AnimatePresence>
        {focusRect && (
          <RowOverlay
            className={`absolute ${shape.focusRing} pointer-events-none z-20 border ${FOCUS_RING_BORDER}`}
            from={false}
            tier={spring.fast}
            to={outsetBox(focusRect, 2)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Surface wiring
// ---------------------------------------------------------------------------

/** The DOM props a menu surface element spreads to keep its overlays honest. */
interface MenuSurfaceProps {
  onMouseEnter: () => void;
  onMouseMove: (event: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}

interface MenuSurfaceOptions {
  /** Pointer entry also drops the focus ring. The popups do this so a mouse
   *  taking over does not leave a ring on the row the keyboard left; the
   *  inline panel keeps it, because the ring is its only focus cue.
   *  @default false */
  clearFocusRingOnPointerEnter?: boolean;
}

/** What a menu surface gets back: the measured row set, the two indices its
 *  overlays read, and the DOM props that keep both honest. Written out rather
 *  than derived from the proximity hook's return type, so the seam is a
 *  contract this module owns — and so `handlers`, which is folded into
 *  `surfaceProps` here, never leaks back out as a second way to wire the same
 *  events. */
interface MenuSurface {
  /** The row nearest the pointer, or null while the pointer is away. */
  activeIndex: number | null;
  setActiveIndex: Dispatch<SetStateAction<number | null>>;
  /** The measured box of every registered row, indexed by row. */
  itemRects: ItemRect[];
  /** True once `itemRects` describes the current row set with no pass
   *  pending. Overlays that mount against an unsettled rect animate across the
   *  list when the correcting pass lands, so gate them on this. */
  isMeasured: boolean;
  /** Bumped once per pointer session; keys the hover overlay's entry. */
  sessionRef: RefObject<number>;
  /** A row publishes its element here and passes null to withdraw it. */
  registerItem: (index: number, element: HTMLElement | null) => void;
  /** Invalidates the published rects and measures again — for a popup that
   *  kept its rows registered while it sat hidden. */
  remeasure: () => void;
  /** Measures again without invalidating — for a panel whose children moved. */
  measureItems: () => void;
  /** The row drawn with a focus ring, or null. */
  focusedIndex: number | null;
  setFocusedIndex: Dispatch<SetStateAction<number | null>>;
  /** Spread onto the surface element. */
  surfaceProps: MenuSurfaceProps;
}

/**
 * Proximity measurement plus the focus-ring index, wired to one container.
 *
 * The focus branch reads `data-proximity-index` off the focused row rather
 * than tracking it in React: the row that takes focus may be moved there by
 * the primitive's roving highlight, which this layer never sees. `:focus-
 * visible` decides whether the ring is drawn at all, so a click that focuses
 * a row highlights it without ringing it.
 */
export function useMenuSurface(
  containerRef: RefObject<HTMLDivElement | null>,
  { clearFocusRingOnPointerEnter = false }: MenuSurfaceOptions = {},
): MenuSurface {
  const proximity = useProximityHover(containerRef);
  const { handlers, setActiveIndex } = proximity;
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const surfaceProps: MenuSurfaceProps = {
    onMouseEnter: () => {
      handlers.onMouseEnter();
      if (clearFocusRingOnPointerEnter) setFocusedIndex(null);
    },
    onMouseMove: handlers.onMouseMove,
    onMouseLeave: handlers.onMouseLeave,
    onFocus: (event) => {
      const target = event.target as HTMLElement;
      const indexAttr = target
        .closest('[data-proximity-index]')
        ?.getAttribute('data-proximity-index');
      if (indexAttr == null) return;
      const index = Number(indexAttr);
      setActiveIndex(index);
      setFocusedIndex(target.matches(':focus-visible') ? index : null);
    },
    onBlur: (event) => {
      if (containerRef.current?.contains(event.relatedTarget as Node)) return;
      setFocusedIndex(null);
      setActiveIndex(null);
    },
  };

  return {
    activeIndex: proximity.activeIndex,
    setActiveIndex: proximity.setActiveIndex,
    itemRects: proximity.itemRects,
    isMeasured: proximity.isMeasured,
    sessionRef: proximity.sessionRef,
    registerItem: proximity.registerItem,
    remeasure: proximity.remeasure,
    measureItems: proximity.measureItems,
    focusedIndex,
    setFocusedIndex,
    surfaceProps,
  };
}

/** The three boxes a surface's overlays track, resolved from its indices. */
interface OverlayRects {
  activeRect: ItemRect | null;
  checkedRect: ItemRect | null;
  focusRect: ItemRect | null;
}

/**
 * Turns a surface's three indices into the three rects its overlays draw.
 *
 * `settledOnly` holds every overlay back until the measurement pass describes
 * the current row set. A popup that keeps its rows registered between opens
 * needs that — an overlay mounted against an unsettled rect sits on the wrong
 * row and then springs across the list when the correcting pass lands — while
 * an always-rendered panel measures once and has nothing to wait for.
 */
export function overlayRects(
  surface: Pick<MenuSurface, 'activeIndex' | 'focusedIndex' | 'isMeasured' | 'itemRects'>,
  checkedIndex: number | undefined,
  { settledOnly = false }: { settledOnly?: boolean } = {},
): OverlayRects {
  const { activeIndex, focusedIndex, isMeasured, itemRects } = surface;
  const at = (index: number | null | undefined) =>
    index == null || (settledOnly && !isMeasured) ? null : (itemRects[index] ?? null);
  return {
    activeRect: at(activeIndex),
    checkedRect: at(checkedIndex),
    focusRect: at(focusedIndex),
  };
}

// ---------------------------------------------------------------------------
// Popup transition
// ---------------------------------------------------------------------------

interface PopupMotionOptions {
  open: boolean;
  /** A popup that opens upward grows from its bottom edge — the edge anchored
   *  to the trigger — so both the offset and the transform origin flip.
   *  @default false */
  fromBottomEdge?: boolean;
}

/** The motion props of a portalled popup's animated wrapper. Spread onto a
 *  `motion.div` that also carries the exit `onAnimationComplete` releasing
 *  the deferred unmount. A hook, not a plain function: the reduced-motion
 *  preference is read here rather than passed in by every popup. */
export function usePopupMotion({ fromBottomEdge = false, open }: PopupMotionOptions) {
  const closed = { opacity: 0, y: fromBottomEdge ? 4 : -4, scaleY: 0.96 };
  const enter = useMotionTier(spring.fast);
  const leave = useMotionTier(spring.fast.exit);
  return {
    initial: closed,
    animate: open ? { opacity: 1, y: 0, scaleY: 1 } : closed,
    transition: open ? enter : leave,
    style: { transformOrigin: fromBottomEdge ? 'bottom center' : 'top center' },
  };
}
