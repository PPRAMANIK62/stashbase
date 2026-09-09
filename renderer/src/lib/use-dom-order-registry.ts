/**
 * The one place a list decides which item is item 0.
 *
 * Rows, options, tabs and cards all need a position: the proximity system
 * measures by index, overlays are keyed by index, and a roving tab stop has to
 * name one. Every list here used to answer that question for itself — a caller
 * counted its children and passed `index`, or a parent walked `children` and
 * cloned one in — which meant a list that inserted an item in the middle
 * silently renumbered everything after it, and a conditional item renumbered
 * the list twice per render.
 *
 * An item registers its ELEMENT instead, and the registry answers "which one
 * is this" by comparing document positions. The DOM is already the ordering
 * every one of those consumers actually means, so deriving the index from it
 * removes the bookkeeping rather than moving it.
 *
 * `mark` carries the one flag a surface needs alongside the order — which item
 * is the chosen one — so a menu can find its checked row without a caller
 * counting to it either.
 */
'use client';

import { useState, useSyncExternalStore, type RefObject } from 'react';

import { useIsoLayoutEffect } from '@/lib/use-iso-layout-effect';

/** Sorts two registered elements by the order they appear in the document. */
const byDocumentOrder = (a: HTMLElement, b: HTMLElement): number => {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
};

/** The items of one list, ordered by where they sit in the document. */
export interface DomOrderRegistry {
  /** Adds `element`; the returned function removes it again. */
  register(element: HTMLElement): () => void;
  /** Subscribes to membership, order and mark changes; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Every registered element, in document order. */
  ordered(): readonly HTMLElement[];
  /** The element's position among the registered items, or -1 while it is not
   *  registered. */
  indexOf(element: HTMLElement | null): number;
  /** Flags `element` as the list's chosen item, or clears that flag. */
  mark(element: HTMLElement, marked: boolean): void;
  /** The chosen item's position, or -1 when nothing is marked. */
  markedIndex(): number;
}

export function createDomOrderRegistry(): DomOrderRegistry {
  const elements = new Set<HTMLElement>();
  const marked = new Set<HTMLElement>();
  const listeners = new Set<() => void>();
  let ordered: HTMLElement[] | null = null;

  const invalidate = () => {
    ordered = null;
    for (const listener of listeners) listener();
  };

  const order = (): HTMLElement[] => {
    if (ordered) return ordered;
    const next = [...elements].toSorted(byDocumentOrder);
    ordered = next;
    // The DOM, not the registry, is the source of order: a list that reorders
    // items it already mounted moves the same elements without re-registering
    // any of them. Dropping the sort on the microtask boundary keeps every
    // read inside one render pass consistent — which is what
    // `useSyncExternalStore` requires of a snapshot — without letting a pass
    // inherit the previous pass's answer.
    queueMicrotask(() => {
      if (ordered === next) ordered = null;
    });
    return next;
  };

  return {
    register(element) {
      elements.add(element);
      invalidate();
      return () => {
        elements.delete(element);
        marked.delete(element);
        invalidate();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ordered: order,
    indexOf(element) {
      return element ? order().indexOf(element) : -1;
    },
    mark(element, isMarked) {
      const had = marked.has(element);
      if (had === isMarked) return;
      if (isMarked) {
        // One chosen item per list: a new mark replaces the old rather than
        // leaving two, so `markedIndex` never has to pick between them.
        marked.clear();
        marked.add(element);
      } else {
        marked.delete(element);
      }
      invalidate();
    },
    markedIndex() {
      for (const element of marked) return order().indexOf(element);
      return -1;
    },
  };
}

/** One registry per list, stable for its lifetime so that neither the context
 *  value nor an item's registration effect churns on re-render. */
export function useDomOrderRegistry(): DomOrderRegistry {
  const [registry] = useState(createDomOrderRegistry);
  return registry;
}

/**
 * The item's index within its list: the position of its element among the
 * registered items, in document order.
 *
 * Returns -1 for the one commit before registration lands. Registration runs
 * in a layout effect, so the corrected value is in the DOM before the browser
 * paints; callers still gate anything index-keyed on a non-negative value.
 *
 * `marked` publishes the item's chosen state to the registry in the same pass,
 * so the surface around it can find the chosen row without being told an index.
 */
export function useDomOrderIndex(
  elementRef: RefObject<HTMLElement | null>,
  registry: DomOrderRegistry,
  marked = false,
): number {
  useIsoLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    return registry.register(element);
  }, [elementRef, registry]);

  useIsoLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    registry.mark(element, marked);
    return () => registry.mark(element, false);
  }, [elementRef, registry, marked]);

  return useSyncExternalStore(
    registry.subscribe,
    () => registry.indexOf(elementRef.current),
    () => -1,
  );
}

/** How many items the list holds, live — the count a surface used to be told
 *  by a caller that had counted its own children, and which the registry
 *  already knows because every item registers itself. */
export function useDomOrderCount(registry: DomOrderRegistry): number {
  return useSyncExternalStore(
    registry.subscribe,
    () => registry.ordered().length,
    () => 0,
  );
}

/** The chosen item's index, or undefined when nothing is marked — the shape a
 *  surface's overlay props take. */
export function useMarkedIndex(registry: DomOrderRegistry): number | undefined {
  const index = useSyncExternalStore(
    registry.subscribe,
    () => registry.markedIndex(),
    () => -1,
  );
  return index < 0 ? undefined : index;
}
