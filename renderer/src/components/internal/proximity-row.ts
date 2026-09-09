/** What every row under a proximity-hover overlay does before it can be
 *  drawn: take its position from where it sits, publish its element to the
 *  surface that draws the overlay, and know whether it is the active row.
 *
 *  A row that skipped any part of this is a row the overlay can never find, so
 *  the three steps travel together rather than being spelled out once per row
 *  kind — menu item, select option, tab. The caller keeps only what it renders
 *  differently. */

'use client';

import { useEffect, useRef, type Ref, type RefCallback } from 'react';

import { mergeRefs } from '@/lib/merge-refs';
import { useDomOrderIndex, type DomOrderRegistry } from '@/lib/use-dom-order-registry';
import { useProximityRegistration } from '@/lib/use-proximity-hover';

/** The surface a row registers with: a menu popup, a select popup, a strip. */
export interface ProximityRowSurface {
  /** The row the pointer or the keyboard is on, or null when none is. */
  activeIndex: number | null;
  /** Publishes the row's element for the hover overlay to measure. */
  registerItem: ((index: number, element: HTMLElement | null) => void) | undefined;
  /** The surface's row registry, which orders rows by where they sit. */
  registry: DomOrderRegistry;
}

interface ProximityRow<E extends HTMLElement> {
  index: number;
  isActive: boolean;
  /** Hand to the row element: the row's own handle merged with the caller's. */
  ref: RefCallback<E>;
  /** True until the row's first effect has run, so a row that mounts already
   *  chosen shows its mark rather than animating it in. */
  skipAnimation: boolean;
}

export function useProximityRow<E extends HTMLElement>(
  forwardedRef: Ref<E> | undefined,
  surface: ProximityRowSurface,
  marked: boolean,
): ProximityRow<E> {
  const internalRef = useRef<E>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Registering also publishes whether this row is the chosen one, so the
  // surface around it can position the selected background without any caller
  // counting rows.
  const index = useDomOrderIndex(internalRef, surface.registry, marked);
  // Depends on the (stable) registerItem rather than the surface context,
  // which is rebuilt on every activeIndex change: keying the effect to the
  // whole context re-ran it per mousemove, unregistering and re-registering
  // every row and so keeping the hook's measurement permanently unsettled
  // while the pointer moved.
  useProximityRegistration(internalRef, index, surface.registerItem);

  return {
    index,
    isActive: surface.activeIndex === index,
    ref: mergeRefs(internalRef, forwardedRef),
    skipAnimation: !hasMounted.current,
  };
}
