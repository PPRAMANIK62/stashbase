/** The sidebar's one-stop entry: the top-level `Sidebar` composition, the
 *  scrolling `SidebarContent` region, and a re-export of every flavor-neutral
 *  part so a feature needs a single import.
 *
 *  `Sidebar` picks the presentation — an always-present column, or the desktop
 *  shell with the mobile sheet mounted alongside it. The shell stays MOUNTED
 *  across the drawer breakpoint and fades instead of unmounting, which is what
 *  stops the rail snapping away the instant a window shrinks. */

'use client';

import { forwardRef, useEffect, type CSSProperties, type HTMLAttributes } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useSidebarInternals } from '@/components/ui/sidebar-context';
import {
  useSidebar,
  sidebarLandmarkLabel,
  SidebarShell,
  type SidebarSide,
  type SidebarVariant,
  type SidebarCollapsible,
} from '@/components/ui/sidebar-core';
import { SidebarSheet } from '@/components/ui/sidebar-sheet';
import { motionStyle } from '@/lib/local/motion-style';
import { cn } from '@/lib/utils';

interface SidebarProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
> {
  side?: SidebarSide;
  variant?: SidebarVariant;
  /** `"icon"` collapse is intentionally not supported — offcanvas or none. */
  collapsible?: SidebarCollapsible;
  /** The `sidebar` variant's inner-edge border. Default true. */
  bordered?: boolean;
  /** Pin the rail's tooltip open (`true`) or closed (`false`); `undefined`
   *  leaves it on hover. Dragging always hides it. */
  railTooltipOpen?: boolean | undefined;
  /** Render the built-in resize/collapse rail. Default true. */
  rail?: boolean;
}

const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      side = 'left',
      variant = 'sidebar',
      collapsible = 'offcanvas',
      bordered = true,
      rail = true,
      railTooltipOpen,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const { isMobile, openMobile, setOpenMobile, width } = useSidebar();
    const { registerSide } = useSidebarInternals();

    // The provider mirrors the side into the default shortcut ("[" / "]")
    // and the rail handle.
    useEffect(() => registerSide(side), [side, registerSide]);

    if (collapsible === 'none') {
      return (
        <div
          ref={ref}
          data-slot="sidebar"
          data-variant={variant}
          data-side={side}
          className={cn(
            'peer sticky top-0 flex h-svh shrink-0 flex-col',
            side === 'right' && 'order-last',
            className,
          )}
          style={{ width, ...style } as CSSProperties}
          {...props}
        >
          <aside
            aria-label={props['aria-label'] ?? sidebarLandmarkLabel(side)}
            data-sidebar="sidebar"
            className={cn(
              'flex h-full min-h-0 w-full flex-col',
              bordered &&
                variant === 'sidebar' &&
                (side === 'left' ? 'border-r border-border' : 'border-l border-border'),
            )}
          >
            {children}
          </aside>
        </div>
      );
    }

    // The sheet mounts alongside the desktop shell below the breakpoint; the
    // hidden shell costs nothing visible (display: none).
    return (
      <>
        {isMobile && (
          <SidebarSheet side={side} open={openMobile} onClose={() => setOpenMobile(false)}>
            {children}
          </SidebarSheet>
        )}
        <SidebarShell
          ref={ref}
          side={side}
          variant={variant}
          bordered={bordered}
          rail={rail}
          railTooltipOpen={railTooltipOpen}
          className={className}
          style={motionStyle(style)}
          {...props}
        >
          {children}
        </SidebarShell>
      </>
    );
  },
);
Sidebar.displayName = 'Sidebar';

interface SidebarContentProps extends HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
}

const SidebarContent = forwardRef<HTMLDivElement, SidebarContentProps>(
  ({ className, viewportClassName, children, ...props }, ref) => {
    const { isMobile } = useSidebar();

    // Inside the mobile sheet, the sheet's flex column owns layout and this
    // region scrolls natively — a nested ScrollArea would double-scroll. The
    // boundary hairline still needs a frame to ride: scroll-divider can't sit
    // on the scroller itself (its own fade mask would erase the line), so the
    // region is wrapped the way ScrollArea wraps its viewport on desktop.
    if (isMobile) {
      return (
        <div className="scroll-divider flex min-h-0 w-full flex-1 flex-col [--scroll-divider-inset:8px]">
          <div
            ref={ref}
            data-sidebar="content"
            className={cn(
              'scroll-fade flex min-h-0 w-full flex-1 flex-col overflow-y-auto',
              className,
            )}
            {...props}
          >
            {children}
          </div>
        </div>
      );
    }

    // The scroll primitive wraps children in an inline-styled sizer that
    // sizes to content — rows would stop shrinking near the min width
    // instead of truncating, so the viewport's direct child is forced back
    // to a plain shrinkable block.
    return (
      <ScrollArea
        className={cn('scroll-divider min-h-0 w-full flex-1', className)}
        viewportClassName={cn('scroll-fade [&>div]:!block [&>div]:!min-w-0', viewportClassName)}
      >
        <div ref={ref} data-sidebar="content" className="flex w-full min-w-0 flex-col" {...props}>
          {children}
        </div>
      </ScrollArea>
    );
  },
);
SidebarContent.displayName = 'SidebarContent';

export { Sidebar, SidebarContent };

// Re-export the flavor-neutral parts so `sidebar` is a one-stop import.
export {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar-core';
export {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar-menu';
