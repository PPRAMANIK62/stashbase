/** A trailing control on a menu row: a rename button, an overflow menu
 *  trigger, a dismiss.
 *
 *  The action registers its own slot with the row so the row's button can
 *  reserve exactly the padding it needs — nothing here measures anything at
 *  runtime. `showOnHover` reveals it on the OWN row only, which is why the
 *  parent and sub rows use different group scopes: a sub action must not track
 *  the parent <li>, whose hover covers the whole expanded sub-tree. */

'use client';

import {
  forwardRef,
  useContext,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactElement,
  type Ref,
} from 'react';

import { MenuItemContext } from '@/components/ui/sidebar-menu-row';
import { FOCUS_RING } from '@/lib/focus-ring';
import { useShape } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import { resolveSlotTemplate, slotElement } from '@/lib/slot-template';
import { useIsoLayoutEffect } from '@/lib/use-iso-layout-effect';
import { cn } from '@/lib/utils';

interface SidebarMenuActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  showOnHover?: boolean;
  render?: ReactElement;
}

const SidebarMenuAction = forwardRef<HTMLButtonElement, SidebarMenuActionProps>(
  ({ className, showOnHover = false, render, children, onClick, ...props }, ref) => {
    const shape = useShape();
    const sizeClasses = useSize();
    const item = useContext(MenuItemContext);
    const { template, content } = resolveSlotTemplate(render, children);

    // Each action registers its own slot, which is what the row's button
    // turns into an exact trailing reservation.
    const setActions = item?.setActions;
    useIsoLayoutEffect(() => {
      if (!setActions) return;
      setActions(1, showOnHover);
      return () => setActions(0, false);
    }, [setActions, showOnHover]);
    return slotElement(
      template,
      'button',
      {
        ref: ref as Ref<HTMLElement>,
        type: template ? undefined : 'button',
        'data-sidebar': 'menu-action',
        'data-show-on-hover': showOnHover ? '' : undefined,
        className: cn(
          // right-1.5 centers the 24px hit-box on the same axis as the badge
          // (right-2 + min-w-5): both land 18px from the row's right edge.
          // With a badge on the same row the badge keeps that rightmost spot
          // and the action slides left of it.
          'absolute right-1.5 z-10 flex size-6 items-center justify-center text-muted-foreground outline-none',
          item?.isSubRow
            ? 'group-has-[>[data-sidebar=menu-badge]]/menu-sub-item:right-8.5'
            : 'group-has-[>[data-sidebar=menu-badge]]/menu-item:right-8.5',
          item?.isSubRow || sizeClasses.variant === 'compact' ? 'top-0.5' : 'top-1',
          'transition-[color,background-color,opacity] duration-fast hover:bg-hover hover:text-foreground',
          FOCUS_RING,
          // One icon size across the sidebar: row actions match the leading
          // icons and the section header's actions, all on the size ladder.
          // Normalize bare icons to the site's 1.5 stroke (library defaults
          // vary), thickening to 2 on hover — Button's icon-only treatment.
          '[&_svg]:size-[var(--icon-size)] [&_svg]:shrink-0 [&_svg]:stroke-[1.5] [&_svg]:transition-[stroke-width] [&_svg]:duration-fast hover:[&_svg]:stroke-[2]',
          shape.item,
          // Reveal on the OWN row only. A sub action must not use the
          // menu-item group — its nearest one is the parent li, which would
          // light every sibling sub action on any hover inside the sub-tree.
          showOnHover &&
            (item?.isSubRow
              ? 'opacity-0 group-focus-within/menu-sub-item:opacity-100 group-hover/menu-sub-item:opacity-100 aria-expanded:opacity-100 data-[state=open]:opacity-100'
              : // Tracks the row's own button (its peer), not the <li> — a row
                // that hosts a sub-menu wraps its children too, and hovering a
                // child should not light the parent's action.
                'opacity-0 peer-hover/menu-button:opacity-100 peer-focus-visible/menu-button:opacity-100 hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 data-[state=open]:opacity-100'),
          className,
        ),
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          // The action often sits on a row composed via `render` — keep its
          // click from also triggering the row.
          event.stopPropagation();
          onClick?.(event);
        },
        ...props,
        style: {
          ...({ '--icon-size': `${sizeClasses.icon}px` } as CSSProperties),
          ...props.style,
        },
      },
      content,
    );
  },
);
SidebarMenuAction.displayName = 'SidebarMenuAction';

export { SidebarMenuAction };
