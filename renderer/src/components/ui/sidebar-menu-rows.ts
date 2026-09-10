/** The bookkeeping behind a sidebar menu's traveling highlights: which rows
 *  exist, in what order, which of them are visible and active, and where each
 *  row's overlay box sits.
 *
 *  Rows register by element, never by index — the shared DOM-order registry
 *  (`@/lib/use-dom-order-registry`) derives every index from where the row
 *  sits, so consumers never pass one and conditional rows just work. What is
 *  particular to a sidebar menu is everything layered on top of that order:
 *  the button each row is measured by, which rows are visible, and where a
 *  row's overlay box sits. Rows in a collapsed sub-tree stay REGISTERED and
 *  are filtered instead: unregistering on every toggle would churn the
 *  proximity measurements and blink the overlays. */

'use client';

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { createDomOrderRegistry } from '@/lib/use-dom-order-registry';
import type { ItemRect } from '@/lib/use-proximity-hover';

/** True while the element sits inside a collapsed sub-tree — clipped away, so
 *  it must be invisible to hover, highlights, and keyboard order. */
export function rowHidden(el: HTMLElement) {
  return el.closest('[data-sidebar="menu-sub"][data-state="closed"]') !== null;
}

function sameElements(a: HTMLElement[], b: HTMLElement[]) {
  return a.length === b.length && a.every((el, i) => el === b[i]);
}

/** The tallest row (size="lg"). Used when a row's button lookup misses, so an
 *  overlay can never cover an expanded sub-tree. */
const TALLEST_ROW_HEIGHT = 48;

interface RowRegistry {
  /** Registers a row's <li>; the returned callback unregisters it. */
  registerRow: (el: HTMLElement) => () => void;
  /** The row's measured element is its BUTTON, not the <li>: a row hosting an
   *  expanded sub-tree is a tall <li>, and hit-testing that whole box would
   *  hand the sub-tree's gaps and gutter to the parent. */
  setRowButton: (row: HTMLElement, button: HTMLElement | null) => void;
  setRowActive: (row: HTMLElement, active: boolean) => void;
  /** Every registered row in DOM order, hidden ones included. */
  orderedRows: HTMLElement[];
  /** A row's DOM index against the LIVE set — callers in the same commit that
   *  changed it must not read the previous render's list. */
  indexOfRow: (row: HTMLElement) => number;
  /** Every visible active row, in DOM order — a parent section marker and the
   *  current row inside its sub-tree can be active at once. */
  activeRows: HTMLElement[];
  /** A row's overlay box, clamped to the height of its button. */
  overlayRect: (row: HTMLElement | null) => ItemRect | null;
  /** A sub-menu toggled: rows changed visibility in place, so the visible
   *  active set is recomputed and a hover riding a row that just collapsed
   *  away is dropped. */
  refreshVisibility: () => void;
}

/** The proximity system's half of the contract — supplied by the menu scope,
 *  which owns the hook this registry feeds. */
interface ProximitySeam {
  registerItem: (index: number, element: HTMLElement | null) => void;
  itemRects: ItemRect[];
  setActiveIndex: Dispatch<SetStateAction<number | null>>;
}

export function useRowRegistry({
  registerItem,
  itemRects,
  setActiveIndex,
}: ProximitySeam): RowRegistry {
  // The registry notifies synchronously on every membership change, and the
  // listener is read through a ref so it always runs the CURRENT sync — the
  // subscription is made once, at creation, before any row can register.
  const syncRef = useRef<() => void>(() => undefined);
  const [registry] = useState(() => {
    const created = createDomOrderRegistry();
    created.subscribe(() => syncRef.current());
    return created;
  });
  const rowButtonsRef = useRef<Map<HTMLElement, HTMLElement>>(new Map());
  const activeMapRef = useRef<Map<HTMLElement, boolean>>(new Map());
  const [orderedRows, setOrderedRows] = useState<HTMLElement[]>([]);
  const orderedRowsRef = useRef(orderedRows);
  orderedRowsRef.current = orderedRows;
  const registeredCountRef = useRef(0);
  const [activeRows, setActiveRows] = useState<HTMLElement[]>([]);

  const recomputeActive = useCallback(() => {
    const next = orderedRowsRef.current.filter(
      (el) => activeMapRef.current.get(el) && !rowHidden(el),
    );
    setActiveRows((prev) => (sameElements(prev, next) ? prev : next));
  }, []);

  const rowButton = useCallback(
    (row: HTMLElement) =>
      rowButtonsRef.current.get(row) ??
      row.querySelector<HTMLElement>(
        ':scope > [data-sidebar="menu-button"], :scope > [data-sidebar="menu-sub-button"]',
      ),
    [],
  );

  const syncRows = useCallback(() => {
    const sorted = [...registry.ordered()];
    // The ref updates synchronously (not just at the next render): callers in
    // the same commit — a row registering, its button turning active — must
    // see the row set they just changed, or the first recompute of a mount
    // filters every row out against the previous render's empty list.
    orderedRowsRef.current = sorted;
    setOrderedRows((prev) => (sameElements(prev, sorted) ? prev : sorted));
    sorted.forEach((el, i) => registerItem(i, rowButton(el) ?? el));
    for (let i = sorted.length; i < registeredCountRef.current; i++) {
      registerItem(i, null);
    }
    registeredCountRef.current = sorted.length;
    recomputeActive();
  }, [registerItem, recomputeActive, registry, rowButton]);
  syncRef.current = syncRows;

  const registerRow = useCallback(
    (el: HTMLElement) => {
      const unregister = registry.register(el);
      return () => {
        rowButtonsRef.current.delete(el);
        activeMapRef.current.delete(el);
        unregister();
      };
    },
    [registry],
  );

  const setRowButton = useCallback(
    (row: HTMLElement, button: HTMLElement | null) => {
      if (button) rowButtonsRef.current.set(row, button);
      else rowButtonsRef.current.delete(row);
      // The button is the row's measured element, so a button arriving after
      // its row registered must re-sync what the proximity system observes.
      syncRows();
    },
    [syncRows],
  );

  const setRowActive = useCallback(
    (row: HTMLElement, active: boolean) => {
      activeMapRef.current.set(row, active);
      recomputeActive();
    },
    [recomputeActive],
  );

  const refreshVisibility = useCallback(() => {
    recomputeActive();
    // A hover riding a row that just collapsed away has nothing under it.
    setActiveIndex((prev) => {
      const row = prev !== null ? orderedRowsRef.current[prev] : undefined;
      return row && rowHidden(row) ? null : prev;
    });
  }, [recomputeActive, setActiveIndex]);

  const indexOfRow = useCallback((row: HTMLElement) => orderedRowsRef.current.indexOf(row), []);

  // A row's rect spans the whole <li> — which grows when it hosts an expanded
  // sub-menu — so overlay heights are clamped to the row's button box.
  const overlayRect = useCallback(
    (row: HTMLElement | null): ItemRect | null => {
      if (!row) return null;
      const idx = orderedRowsRef.current.indexOf(row);
      const rect = idx === -1 ? null : itemRects[idx];
      if (!rect) return null;
      const height = Math.min(rect.height, rowButton(row)?.offsetHeight ?? TALLEST_ROW_HEIGHT);
      return { ...rect, height };
    },
    [itemRects, rowButton],
  );

  return {
    registerRow,
    setRowButton,
    setRowActive,
    orderedRows,
    indexOfRow,
    activeRows,
    overlayRect,
    refreshVisibility,
  };
}
