import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * The app's one popup-menu primitive. Both kinds of menu route through it:
 *
 *   - button menus (the sidebar `⋯` / new-note pickers) anchor to a
 *     trigger's bounding rect and grow downward from its left edge;
 *   - context menus (file/folder right-click) anchor to the cursor point.
 *
 * Why a shared component: every menu needs the same load-bearing,
 * easy-to-get-wrong behaviour — viewport-aware positioning (so it never
 * bleeds off-screen or under the icon rail the way the old hand-rolled
 * `right: 0` menus did), click-outside / Esc / blur dismissal, and arrow-key
 * navigation. Encoding it once is what lets new menus be a data array, not a
 * fresh copy of the positioning bug.
 *
 * Rendered with `position: fixed`, so it escapes any `overflow: hidden`
 * ancestor (the sidebar clips its own subtree). No portal needed as long as
 * no ancestor establishes a containing block via `transform`/`filter`.
 */

export type MenuItem =
  | { separator: true }
  | {
      separator?: false;
      label: string;
      /** Optional second line, smaller + muted (e.g. "richer structure · default"). */
      detail?: string;
      /** Right-aligned hint, e.g. a keyboard shortcut glyph. */
      shortcut?: string;
      danger?: boolean;
      disabled?: boolean;
      /** Native tooltip. */
      title?: string;
      onSelect: () => void;
    };

/** Anchor the menu to a cursor point (context menu) or a trigger's rect
 *  (button menu). For a rect anchor the menu's left edge aligns to the
 *  trigger's left and it drops below it; pass `align: 'right'` to align the
 *  menu's right edge to the trigger's right instead. */
export type MenuAnchor =
  | { x: number; y: number }
  | { rect: DOMRect; align?: 'left' | 'right' };

const MARGIN = 6; // keep this far from the viewport edge
const GAP = 4; // distance between a trigger rect and the menu

export function Menu({
  anchor,
  items,
  onClose,
  minWidth,
}: {
  anchor: MenuAnchor;
  items: MenuItem[];
  onClose: () => void;
  minWidth?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Measure, then clamp to the viewport so the menu is always fully on
  // screen. For a trigger rect that has no room below, flip above it.
  // Runs in a layout effect (before paint) so there's no visible jump; the
  // menu stays opacity:0 until `pos` lands (the `.ready` class fades it in).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left: number;
    let top: number;
    if ('rect' in anchor) {
      const r = anchor.rect;
      left = anchor.align === 'right' ? r.right - width : r.left;
      top = r.bottom + GAP;
      const overflowsBelow = top + height > window.innerHeight - MARGIN;
      const roomAbove = r.top - height - GAP >= MARGIN;
      if (overflowsBelow && roomAbove) top = r.top - height - GAP;
    } else {
      left = anchor.x;
      top = anchor.y;
    }
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN));
    setPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, [anchor]);

  // Focus the first actionable item on open so arrow-key nav and Enter work
  // immediately. Disabled items are native <button disabled> and skip focus.
  useEffect(() => {
    const first = items.findIndex((it) => !it.separator && !it.disabled);
    if (first >= 0) itemRefs.current[first]?.focus();
    // Only on mount: re-focusing on every items change would steal focus mid-use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dismiss on outside mousedown / window blur. Esc is handled on the
  // container's onKeyDown (the focused item bubbles to it), with a
  // document-level fallback in case nothing inside is focused.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  function focusableIndices(): number[] {
    return items.reduce<number[]>((acc, it, i) => {
      if (!it.separator && !it.disabled) acc.push(i);
      return acc;
    }, []);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const f = focusableIndices();
    if (!f.length) return;
    const activeItem = itemRefs.current.findIndex((el) => el === document.activeElement);
    const cur = f.indexOf(activeItem);
    let next: number;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = f.length - 1;
    else if (e.key === 'ArrowDown') next = cur < 0 ? 0 : Math.min(cur + 1, f.length - 1);
    else next = cur < 0 ? f.length - 1 : Math.max(cur - 1, 0);
    itemRefs.current[f[next]]?.focus();
  }

  return (
    <div
      ref={ref}
      className={'menu' + (pos ? ' ready' : '')}
      role="menu"
      onKeyDown={onKeyDown}
      style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, minWidth }}
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : (
          <button
            key={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            className={'menu-item' + (it.danger ? ' danger' : '')}
            role="menuitem"
            disabled={it.disabled}
            title={it.title}
            // Hover moves focus so the highlight tracks the pointer instead
            // of leaving the open-focused first item lit alongside it — i.e.
            // :hover and :focus always land on the same row.
            onMouseEnter={(e) => e.currentTarget.focus()}
            onClick={() => {
              it.onSelect();
              onClose();
            }}
          >
            <span className="menu-item-body">
              <span className="menu-item-label">{it.label}</span>
              {it.detail && <span className="menu-item-detail">{it.detail}</span>}
            </span>
            {it.shortcut && <span className="menu-item-shortcut">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
