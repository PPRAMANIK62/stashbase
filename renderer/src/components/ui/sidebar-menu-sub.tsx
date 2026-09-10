/** A nested level of the menu: the collapsible <ul> that holds sub rows.
 *
 *  A sub-menu is not its own highlight scope — its rows register with the
 *  surrounding SidebarMenu, so one hover background glides from a parent row
 *  into its children. Toggling flips the rows' visibility in place (they stay
 *  registered) and the scope re-reads what is visible, which is why the
 *  collapse is a measured height rather than an unmount. */

'use client';

import { forwardRef, useContext, useId, type HTMLAttributes } from 'react';

import { Collapse } from '@/components/internal/collapse';
import { MenuScopeContext } from '@/components/ui/sidebar-menu-scope';
import { mergeRefs } from '@/lib/merge-refs';
import { useIsoLayoutEffect } from '@/lib/use-iso-layout-effect';
import { useMeasuredSize } from '@/lib/use-measured-size';
import { cn } from '@/lib/utils';

interface SidebarMenuSubProps extends HTMLAttributes<HTMLUListElement> {
  /** Built-in measured-height collapse. Omitted, the sub-menu is always
   *  visible; wire it to state (with a toggling SidebarMenuButton) for a
   *  collapsible tree. */
  open?: boolean;
}

const SidebarMenuSub = forwardRef<HTMLUListElement, SidebarMenuSubProps>(
  ({ className, open = true, children, ...props }, ref) => {
    // Names this level for the menu's per-level active overlay. React mints
    // it, so the identity lives with the component instance rather than in a
    // module-level counter that outlives every menu on the page.
    const levelId = useId();
    const scope = useContext(MenuScopeContext);
    const refreshVisibility = scope?.refreshVisibility;
    useIsoLayoutEffect(() => {
      refreshVisibility?.();
    }, [open, refreshVisibility]);

    const content = useMeasuredSize<HTMLUListElement>({ acceptZero: true });

    return (
      <Collapse
        height={content.size}
        hideWhenClosed
        open={open}
        retarget="snap"
        slot="sidebar-menu-sub-wrapper"
      >
        <ul
          ref={mergeRefs(content.ref, ref)}
          data-sidebar="menu-sub"
          data-menu-level={levelId}
          data-state={open ? 'open' : 'closed'}
          aria-hidden={open ? undefined : true}
          className={cn(
            // ml-[15px] (a margin, not a translate, so the rows' measured
            // rects include it) + 1px border + pl-2 lands the sub-row label
            // (+ the row's own pl-2 = 32px) exactly on the parent label's x
            // (px-2 + 16px icon + gap-2 = 32px).
            'relative ml-[15px] flex min-w-0 flex-col gap-0.5 border-l border-border pl-2 select-none',
            className,
          )}
          {...props}
        >
          {children}
        </ul>
      </Collapse>
    );
  },
);
SidebarMenuSub.displayName = 'SidebarMenuSub';

export { SidebarMenuSub };
