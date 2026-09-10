/** The menu itself, and the scope every row inside it joins.
 *
 *  One scope per SidebarMenu tree: a single proximity-hover system plus the
 *  traveling overlays that glide between every visible row, sub-menu rows
 *  included, so the hover moves from a parent into its children as one
 *  continuous piece. A sub-menu is NOT its own scope — its rows register with
 *  the surrounding menu, and their rects are accumulated into the menu's own
 *  coordinate space by the proximity hook.
 *
 *  The scope also owns keyboard navigation over the whole tree and the rule
 *  that freezes hover tracking while a popup anchored in the sidebar is open. */

'use client';

import {
  createContext,
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
} from 'react';

import { MenuOverlays } from '@/components/ui/sidebar-menu-overlays';
import { rowHidden, useRowRegistry } from '@/components/ui/sidebar-menu-rows';
import { mergeRefs } from '@/lib/merge-refs';
import { SizeProvider, type SizeVariant } from '@/lib/size-context';
import { useProximityHover } from '@/lib/use-proximity-hover';
import { cn } from '@/lib/utils';

const ROW_SELECTOR = '[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]';
const NAVIGATION_KEYS = new Set(['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End']);

interface MenuScopeValue {
  registerRow: (el: HTMLElement) => () => void;
  setRowButton: (row: HTMLElement, button: HTMLElement | null) => void;
  setRowActive: (row: HTMLElement, active: boolean) => void;
  hoveredRowEl: HTMLElement | null;
  /** Every visible active row, in DOM order — a parent section marker and
   *  the current row inside its sub-tree can be active at once. */
  activeRows: HTMLElement[];
  firstRowEl: HTMLElement | null;
  hasActive: boolean;
  /** A sub-menu toggled: rows changed visibility in place, so hover targets
   *  and the visible active set must be recomputed. */
  refreshVisibility: () => void;
}

export const MenuScopeContext = createContext<MenuScopeValue | null>(null);

interface MenuScope {
  value: MenuScopeValue;
  containerProps: {
    onMouseEnter: () => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    onFocus: (e: React.FocusEvent) => void;
    onBlur: (e: React.FocusEvent) => void;
    onPointerDown: () => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
  };
  overlays: React.ReactNode;
}

function useMenuScope(containerRef: RefObject<HTMLElement | null>): MenuScope {
  const { activeIndex, setActiveIndex, itemRects, isMeasured, sessionRef, handlers, registerItem } =
    useProximityHover(containerRef, { isItemDisabled: rowHidden });
  const rows = useRowRegistry({ registerItem, itemRects, setActiveIndex });
  const { orderedRows, indexOfRow, activeRows, overlayRect } = rows;
  const [focusedRowEl, setFocusedRowEl] = useState<HTMLElement | null>(null);

  // While a popup anchored in the sidebar is open (a row action's or the
  // header/footer rows' dropdown), hover tracking freezes across every menu
  // scope — otherwise a non-modal popup lets rows underneath keep
  // highlighting. Popup triggers are detected by the primitives' open
  // attributes (Radix data-state, Base UI data-popup-open); collapsible rows
  // only set aria-expanded, so they never match.
  const popupOpen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    const root = container.closest('[data-slot="sidebar-wrapper"]') ?? container;
    return !!root.querySelector(
      '[data-sidebar="menu-button"][data-state="open"], [data-sidebar="menu-button"][data-popup-open], [data-sidebar="menu-action"][data-state="open"], [data-sidebar="menu-action"][data-popup-open]',
    );
  }, [containerRef]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (popupOpen()) return;
      handlers.onMouseMove(e);
    },
    [popupOpen, handlers],
  );

  const onFocus = useCallback(
    (e: React.FocusEvent) => {
      const target = e.target as HTMLElement;
      // Only the row's main button drives the traveling highlight and ring —
      // actions keep their own static focus rings.
      if (!target.closest('[data-sidebar="menu-button"],[data-sidebar="menu-sub-button"]')) return;
      const row = target.closest(
        '[data-sidebar="menu-item"],[data-sidebar="menu-sub-item"]',
      ) as HTMLElement | null;
      if (!row) return;
      const idx = indexOfRow(row);
      if (idx === -1) return;
      setActiveIndex(idx);
      setFocusedRowEl(target.matches(':focus-visible') ? row : null);
    },
    [indexOfRow, setActiveIndex],
  );

  const onPointerDown = useCallback(() => {
    setFocusedRowEl(null);
  }, []);

  const onBlur = useCallback(
    (e: React.FocusEvent) => {
      if (containerRef.current?.contains(e.relatedTarget as Node)) return;
      setFocusedRowEl(null);
      setActiveIndex(null);
    },
    [containerRef, setActiveIndex],
  );

  // Arrow/Home/End over every button in DOM order, sub rows included — only
  // the root scope binds it so nested scopes don't double-handle.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!NAVIGATION_KEYS.has(e.key)) return;
      const container = containerRef.current;
      if (!container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(ROW_SELECTOR)).filter(
        (el) => !el.closest('[data-sidebar="menu-sub"][data-state="closed"]'),
      );
      const currentIdx = items.indexOf(e.target as HTMLElement);
      if (currentIdx === -1) return;
      e.preventDefault();
      // Keep handled arrows from also reaching window-level listeners (the
      // docs site's ←/→ page navigation) — same rule as AskUserQuestions.
      e.stopPropagation();
      if (e.key === 'Home') items[0]?.focus();
      else if (e.key === 'End') items[items.length - 1]?.focus();
      else {
        const next = ['ArrowDown', 'ArrowRight'].includes(e.key)
          ? (currentIdx + 1) % items.length
          : (currentIdx - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    },
    [containerRef],
  );

  const hoveredRowEl = activeIndex !== null ? (orderedRows[activeIndex] ?? null) : null;
  const { registerRow, setRowButton, setRowActive, refreshVisibility } = rows;

  const value = useMemo<MenuScopeValue>(
    () => ({
      registerRow,
      setRowButton,
      setRowActive,
      hoveredRowEl,
      activeRows,
      firstRowEl: orderedRows[0] ?? null,
      hasActive: activeRows.length > 0,
      refreshVisibility,
    }),
    [
      registerRow,
      setRowButton,
      setRowActive,
      hoveredRowEl,
      activeRows,
      orderedRows,
      refreshVisibility,
    ],
  );

  /** A row's overlay level: its sub-menu <ul>, or the menu root. */
  const rowLevel = useCallback(
    (row: HTMLElement) => row.closest('[data-sidebar="menu-sub"]') ?? containerRef.current,
    [containerRef],
  );

  return {
    value,
    containerProps: {
      onMouseEnter: handlers.onMouseEnter,
      onMouseMove,
      onMouseLeave: handlers.onMouseLeave,
      onFocus,
      onBlur,
      // Pointer interaction switches modality back to pointer. Clicking the
      // already-focused row never re-fires focus, so without this the
      // keyboard ring would stick until focus left the menu.
      onPointerDown,
      onKeyDown,
    },
    overlays: isMeasured ? (
      <MenuOverlays
        activeRows={activeRows}
        hoveredRowEl={hoveredRowEl}
        focusedRowEl={focusedRowEl}
        overlayRect={overlayRect}
        rowLevel={rowLevel}
        sessionKey={sessionRef.current}
      />
    ) : null,
  };
}

interface SidebarMenuProps extends HTMLAttributes<HTMLUListElement> {
  /** Pins the menu's rows to one step of the size ladder. Omitted, they
   *  follow the surrounding SizeProvider. */
  size?: SizeVariant;
}

const SidebarMenu = forwardRef<HTMLUListElement, SidebarMenuProps>(
  ({ className, size, children, ...props }, ref) => {
    const containerRef = useRef<HTMLUListElement>(null);
    const { value, containerProps, overlays } = useMenuScope(containerRef);

    const content = (
      <MenuScopeContext.Provider value={value}>
        <ul
          ref={mergeRefs(containerRef, ref)}
          data-sidebar="menu"
          className={cn('relative flex w-full min-w-0 flex-col select-none', className)}
          {...containerProps}
          {...props}
        >
          {/* The overlays are absolutely positioned decoration, but a <ul>
              may only hold <li> children — so they ride in one presentational
              row with `display: contents`, which changes no layout and keeps
              the list's structure valid. Without it the whole menu stops being
              announced as a list the moment the first measurement lands. */}
          <li aria-hidden="true" className="contents">
            {overlays}
          </li>
          {children}
        </ul>
      </MenuScopeContext.Provider>
    );

    return size ? <SizeProvider size={size}>{content}</SizeProvider> : content;
  },
);
SidebarMenu.displayName = 'SidebarMenu';

export { SidebarMenu };
