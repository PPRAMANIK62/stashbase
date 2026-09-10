/** The magnetic pointer-hover system every list, menu, tab strip and card
 *  grid in this library shares: a registry of item elements, one coalesced
 *  measurement pass over them, and a rAF-throttled pointer handler that
 *  publishes the nearest item as `activeIndex`.
 *
 *  This module owns registration, scheduling and state only — the rect math
 *  it runs on lives in `./proximity-geometry`. Its public surface is frozen:
 *  a dozen primitives import `useProximityHover` and `ItemRect` from here. */

'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import {
  measureItemRect,
  readContainerProjection,
  rectsMatch,
  resolveNearestIndex,
  type ItemRect,
  type ProximityAxis,
} from './proximity-geometry';

export type { ItemRect } from './proximity-geometry';

interface UseProximityHoverOptions {
  /**
   * Which direction to resolve the nearest item along. See `ProximityAxis`.
   */
  axis?: ProximityAxis;
  /**
   * Makes an item invisible to hit-testing without unregistering it — for
   * rows that stay mounted while clipped away (a collapsed sub-tree).
   * Unregistering would invalidate every measurement; a skipped item keeps
   * the set stable. Consulted per mouse move, so keep it cheap.
   */
  isItemDisabled?: (element: HTMLElement) => boolean;
}

interface UseProximityHoverReturn {
  activeIndex: number | null;
  setActiveIndex: Dispatch<SetStateAction<number | null>>;
  itemRects: ItemRect[];
  /**
   * True once every registered item has been measured and no remeasure is
   * pending, i.e. `itemRects` describes the current item set. Gate absolutely
   * positioned overlays on it: an overlay that mounts against a rect a later
   * pass still corrects animates from the wrong place to the right one, which
   * reads as the highlight sliding in from another row.
   */
  isMeasured: boolean;
  sessionRef: RefObject<number>;
  handlers: {
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  registerItem: (index: number, element: HTMLElement | null) => void;
  /**
   * Invalidates the published rects and runs the hook's coalesced measurement
   * pass again, holding `isMeasured` false until it settles. Reach for it when
   * something other than item registration invalidates layout — a popup that
   * stays mounted between opens keeps its items registered, so nothing else
   * would notice that its rects were taken while it was hidden.
   */
  remeasure: () => void;
  measureItems: () => void;
}

/**
 * How many frames the coalesced remeasure retries while the registered items
 * still have no layout box. A popup can be in the DOM one frame before it is
 * laid out; retrying beats publishing zeroed rects, and the cap keeps a list
 * that stays hidden for good from spinning frames forever.
 */
const measurementAttempts = 3;

export function useProximityHover<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  options: UseProximityHoverOptions = {},
): UseProximityHoverReturn {
  const { axis = 'y', isItemDisabled } = options;
  const itemsRef = useRef(new Map<number, HTMLElement>());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [itemRects, setItemRects] = useState<ItemRect[]>([]);
  const [isMeasured, setIsMeasured] = useState(false);
  const itemRectsRef = useRef<ItemRect[]>([]);
  const sessionRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const remeasureRafIdRef = useRef<number | null>(null);

  /**
   * Publishes a rect for every registered item. Returns false when the
   * measurement could not be completed (no container, or an item without a
   * layout box) — nothing is published in that case, so the last complete
   * measurement stands instead of being overwritten with zeroes.
   */
  const runMeasurement = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    const rects: ItemRect[] = [];
    let everyItemHasLayout = true;
    itemsRef.current.forEach((element, index) => {
      const rect = measureItemRect(element, container);
      if (!rect) {
        everyItemHasLayout = false;
        return;
      }
      rects[index] = rect;
    });
    if (!everyItemHasLayout) return false;
    // Skip the state update when nothing moved, so redundant remeasures don't
    // churn re-renders through every consumer of the published rects.
    if (!rectsMatch(itemRectsRef.current, rects)) {
      itemRectsRef.current = rects;
      setItemRects(rects);
    }
    return true;
  }, [containerRef]);

  const measureItems = useCallback(() => {
    runMeasurement();
  }, [runMeasurement]);

  /**
   * The hook's single measurement pass: coalesces every trigger (item
   * registration, container resize) into one remeasure on the next frame and
   * is the only place readiness is reported, so `isMeasured` can never turn
   * true while another pass is still queued.
   */
  const scheduleMeasurement = useCallback(
    (attemptsLeft: number) => {
      if (remeasureRafIdRef.current !== null) {
        cancelAnimationFrame(remeasureRafIdRef.current);
      }
      remeasureRafIdRef.current = requestAnimationFrame(() => {
        remeasureRafIdRef.current = null;
        if (runMeasurement()) {
          setIsMeasured(true);
        } else if (attemptsLeft > 1) {
          scheduleMeasurement(attemptsLeft - 1);
        }
      });
    },
    [runMeasurement],
  );

  const remeasure = useCallback(() => {
    // Readiness drops first: until the pass below settles, the published rects
    // may not describe what is on screen, and an overlay positioned from them
    // would be corrected after mounting — which animates as a slide.
    setIsMeasured(false);
    scheduleMeasurement(measurementAttempts);
  }, [scheduleMeasurement]);

  // Observes the registered items themselves (not just the container): rows
  // that change size in place — e.g. the site-wide size step flipping while a
  // selection background is up — must invalidate the published rects even when
  // the container the effect below captured has since been remounted and the
  // ref points at a different element than the one being observed.
  const itemRoRef = useRef<ResizeObserver | null>(null);
  const getItemRo = useCallback(() => {
    if (itemRoRef.current === null && typeof ResizeObserver !== 'undefined') {
      itemRoRef.current = new ResizeObserver(() => scheduleMeasurement(measurementAttempts));
    }
    return itemRoRef.current;
  }, [scheduleMeasurement]);

  const registerItem = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (element) {
        itemsRef.current.set(index, element);
        getItemRo()?.observe(element);
      } else {
        const previous = itemsRef.current.get(index);
        if (previous) itemRoRef.current?.unobserve(previous);
        itemsRef.current.delete(index);
      }
      // Coalesce rapid register/unregister calls (e.g. when an AnimatePresence
      // remounts a list of rows) into a single remeasure on the next frame,
      // so consumers don't have to manually call measureItems after the
      // container's children swap.
      remeasure();
    },
    [remeasure, getItemRo],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pointerX = e.clientX;
      const pointerY = e.clientY;

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const container = containerRef.current;
        if (!container) return;

        setActiveIndex(
          resolveNearestIndex({
            axis,
            rects: itemRectsRef.current,
            pointerX,
            pointerY,
            projection: readContainerProjection(container),
            isSkipped: (index) => {
              const element = itemsRef.current.get(index);
              return element !== undefined && isItemDisabled?.(element) === true;
            },
          }),
        );
      });
    },
    [axis, containerRef, isItemDisabled],
  );

  const handleMouseEnter = useCallback(() => {
    sessionRef.current += 1;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setActiveIndex(null);
  }, []);

  // Remeasure when the container resizes — a reflow moves items even though
  // the registered set is unchanged, which would otherwise leave itemRects
  // stale. Coalesced through the same rAF as register/unregister. Readiness is
  // deliberately not dropped: the item set is unchanged, so the published rects
  // stay usable, and hiding overlays on every reflow would flicker them.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => scheduleMeasurement(measurementAttempts));
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, scheduleMeasurement]);

  // Clean up rAF and the item observer on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (remeasureRafIdRef.current !== null) {
        cancelAnimationFrame(remeasureRafIdRef.current);
      }
      itemRoRef.current?.disconnect();
      itemRoRef.current = null;
    };
  }, []);

  return {
    activeIndex,
    setActiveIndex,
    itemRects,
    isMeasured,
    sessionRef,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    registerItem,
    remeasure,
    measureItems,
  };
}

/**
 * Publishes one item's element to a proximity container under the index the
 * DOM-order registry derived for it, and withdraws it on the way out.
 *
 * Every measured item in the kit — menu rows, select options, both kinds of
 * tab, cards — does exactly this, and each had written the same effect with
 * the same two-line teardown. The negative-index guard is the point of having
 * it in one place: an item's index is -1 for the one commit before
 * registration lands, and publishing that would put the item in slot -1 and
 * leave it there.
 */
export function useProximityRegistration(
  elementRef: RefObject<HTMLElement | null>,
  index: number,
  registerItem: ((index: number, element: HTMLElement | null) => void) | undefined,
): void {
  useEffect(() => {
    if (index < 0 || !registerItem) return;
    registerItem(index, elementRef.current);
    return () => registerItem(index, null);
  }, [elementRef, index, registerItem]);
}
