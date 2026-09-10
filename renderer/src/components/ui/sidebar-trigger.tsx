/** The sidebar's toggle button: a ghost icon button whose glyph mirrors the
 *  sidebar's edge and whose tooltip names the action with the toggle
 *  keystroke.
 *
 *  With hover-peek enabled the COLLAPSED trigger doubles as a peek
 *  affordance, sharing the provider's single intent timer with the shell's
 *  edge strip so moving between them never races two timers. */

'use client';

import { forwardRef } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { useShortcutKey, useSidebar, useSidebarInternals } from '@/components/ui/sidebar-context';
import { ShortcutKbd } from '@/components/ui/sidebar-shortcut';
import { Tooltip } from '@/components/ui/tooltip';
import { useIcon } from '@/lib/icon-context';
import { useSizeVariant } from '@/lib/size-context';

type SidebarTriggerProps = ButtonProps;

const SidebarTrigger = forwardRef<HTMLButtonElement, SidebarTriggerProps>(
  ({ onClick, size, children, ...props }, ref) => {
    const { toggleSidebar, open, openMobile, isMobile, side } = useSidebar();
    const { peek, isPeeking, schedulePeek, cancelPeekTimer } = useSidebarInternals();
    const shortcutKey = useShortcutKey();
    // With hover-peek enabled, the COLLAPSED trigger is a peek affordance
    // too: resting on it floats the rail out exactly like the edge strip —
    // same shared intent timer, so moving from the trigger into the peeked
    // card (or back) cancels the pending dismissal.
    const hoverPeek = peek === 'hover' && !isMobile && !open;
    const PanelLeftIcon = useIcon('panel-left');
    const PanelRightIcon = useIcon('panel-right');
    const TriggerIcon = side === 'right' ? PanelRightIcon : PanelLeftIcon;
    const iconSize = useSizeVariant() === 'compact' ? ('icon-compact' as const) : ('icon' as const);
    const collapsed = isMobile ? !openMobile : !open;

    return (
      <Tooltip
        side="bottom"
        content={
          <span className="flex items-center gap-1.5">
            {/* A flex row escapes the surface's text-box trim, so the label
                re-applies it — otherwise the shortcut row would sit taller
                than a tooltip without a chip. */}
            <span className="[text-box:trim-both_cap_alphabetic]">
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </span>
            <ShortcutKbd>{shortcutKey}</ShortcutKbd>
          </span>
        }
      >
        <Button
          ref={ref}
          variant="ghost"
          size={size ?? iconSize}
          data-sidebar="trigger"
          aria-label="Toggle Sidebar"
          onClick={(event) => {
            onClick?.(event);
            toggleSidebar();
          }}
          onPointerEnter={
            hoverPeek
              ? (event: React.PointerEvent) => {
                  if (event.pointerType !== 'mouse') return;
                  if (isPeeking) cancelPeekTimer();
                  else schedulePeek();
                }
              : undefined
          }
          // While PEEKED the shell's geometric watcher owns dismissal — a
          // leave fired here can be the peek card sliding over a stationary
          // cursor (layout-driven boundary event, no accompanying move to
          // disarm it), which would flicker the peek closed and open again.
          // This leave only retires a pending intent timer.
          onPointerLeave={
            hoverPeek
              ? () => {
                  if (!isPeeking) cancelPeekTimer();
                }
              : undefined
          }
          {...props}
        >
          {children ?? <TriggerIcon />}
        </Button>
      </Tooltip>
    );
  },
);
SidebarTrigger.displayName = 'SidebarTrigger';

export { SidebarTrigger };
