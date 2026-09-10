/** The sidebar's fixed regions and the page area beside them: the header and
 *  footer that bracket the scrolling content, and the inset main element that
 *  reflows as the rail's width animates.
 *
 *  The inset reads the rail's state through `peer-data-*` selectors rather
 *  than context, so it stays a plain <main> that can be composed anywhere
 *  after the sidebar in the wrapper's flex row. */

'use client';

import { forwardRef, type HTMLAttributes } from 'react';

import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';

type SidebarSectionProps = HTMLAttributes<HTMLDivElement>;

const SidebarHeader = forwardRef<HTMLDivElement, SidebarSectionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn('flex shrink-0 flex-col gap-2 p-2', className)}
      {...props}
    />
  ),
);
SidebarHeader.displayName = 'SidebarHeader';

const SidebarFooter = forwardRef<HTMLDivElement, SidebarSectionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn('mt-auto flex shrink-0 flex-col gap-2 p-2', className)}
      {...props}
    />
  ),
);
SidebarFooter.displayName = 'SidebarFooter';

type SidebarInsetProps = HTMLAttributes<HTMLElement>;

const SidebarInset = forwardRef<HTMLElement, SidebarInsetProps>(({ className, ...props }, ref) => {
  const shape = useShape();
  return (
    <main
      ref={ref}
      data-slot="sidebar-inset"
      className={cn(
        'relative flex min-h-0 w-full min-w-0 flex-1 flex-col bg-background',
        'peer-data-[variant=inset]:m-2 peer-data-[variant=inset]:peer-data-[side=left]:ml-0 peer-data-[variant=inset]:peer-data-[side=right]:mr-0',
        // With the rail collapsed away, restore the sidebar-side margin so
        // the card keeps symmetric insets.
        'peer-data-[variant=inset]:peer-data-[state=collapsed]:peer-data-[side=left]:ml-2 peer-data-[variant=inset]:peer-data-[state=collapsed]:peer-data-[side=right]:mr-2',
        'transition-[margin] duration-fast',
        // Container radius follows the shape system (literal classes so
        // Tailwind's scanner emits both).
        shape.bgRadius >= 20
          ? 'peer-data-[variant=inset]:rounded-3xl'
          : 'peer-data-[variant=inset]:rounded-xl',
        'peer-data-[variant=inset]:bg-surface-2 peer-data-[variant=inset]:shadow-surface-2',
        className,
      )}
      {...props}
    />
  );
});
SidebarInset.displayName = 'SidebarInset';

export { SidebarHeader, SidebarFooter, SidebarInset };
