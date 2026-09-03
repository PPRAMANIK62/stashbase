import { type ReactNode } from 'react';
import { lazyWithRetry } from '@/common/components/ErrorBoundary';
import { LazyManaged } from '@/common/components/LazyManaged';
import { PopupLoadingStatus } from '@/common/components/ui/status';

export type MenuItem =
  | { separator: true }
  | {
      /** Quiet non-interactive section label ("Favorites", "Recent") —
       *  grouping without a hairline, matching the pill menus' idiom. */
      heading: string;
      separator?: false;
    }
  | {
      /** Cascading submenu row: opens `items` in a child popup BESIDE the
       *  parent, which stays on screen. ATTACHED-trigger compositions
       *  only (see the Submenu note in ui/menu.tsx) — ManagedMenu's
       *  detached root must never receive one of these. */
      separator?: false;
      heading?: undefined;
      label: string;
      icon?: ReactNode;
      detail?: string;
      disabled?: boolean;
      title?: string;
      items: MenuItem[];
      onSelect?: undefined;
    }
  | {
      separator?: false;
      heading?: undefined;
      items?: undefined;
      label: string;
      /** Optional leading glyph (a 16px icon element). */
      icon?: ReactNode;
      detail?: string;
      shortcut?: string;
      danger?: boolean;
      disabled?: boolean;
      /** Marks the current choice with the trailing accent DOT (and
       *  `menuitemradio`/`aria-checked` semantics, like `checked`). The
       *  picker idiom for rows that already carry an attention dot slot —
       *  one mark language, no separate check glyph. Give it to every row
       *  of the picker, not just the current one. */
      current?: boolean;
      /** Marks the current choice in picker-style menus. Defining it (true
       *  OR false) turns the row into a `menuitemradio` carrying
       *  `aria-checked`, so give it to every row of a picker, not just the
       *  current one; the checked row also wears the trailing accent check
       *  (the app's selection idiom: neutral surface + accent mark). */
      checked?: boolean;
      /** Quiet needs-attention dot after the label (e.g. a library folder
       *  whose preparation failed) — a signal, never a color wash. */
      attention?: boolean;
      title?: string;
      /** Keep focus at the destination mounted by this action instead of
       * returning it to the menu invoker. */
      returnFocus?: boolean;
      onSelect: () => void;
    };

export type MenuAnchor =
  | { x: number; y: number }
  | { rect: DOMRect; align?: 'left' | 'right' };

export interface MenuProps {
  anchor: MenuAnchor;
  items: MenuItem[];
  /** Items pinned above the scrollable body (e.g. the folder switcher's
   *  add-folder actions): when the list below overflows the popup's
   *  height cap, these stay put while `items` scroll. */
  pinnedItems?: MenuItem[];
  onClose: () => void;
  minWidth?: number;
}

const ManagedMenu = lazyWithRetry(() => import('@/common/components/ManagedMenu'));

export function Menu(props: MenuProps) {
  const { anchor } = props;
  const left = 'x' in anchor ? anchor.x : anchor.rect.left;
  const top = 'y' in anchor ? anchor.y : anchor.rect.bottom + 4;
  return (
    <LazyManaged
      as={ManagedMenu}
      fallback={(
        <PopupLoadingStatus
          label="Opening menu…"
          left={left}
          top={top}
          onCancel={props.onClose}
        />
      )}
      componentProps={props}
    />
  );
}
