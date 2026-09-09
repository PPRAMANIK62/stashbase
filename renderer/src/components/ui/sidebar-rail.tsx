/** The grab strip on the sidebar's inner edge: drag it to resize, click it to
 *  collapse.
 *
 *  The drag is a single pointer-captured gesture with three outcomes — a
 *  clamped resize, a collapse preview once it is thrown past the minimum
 *  width (revocable until release), and a plain collapse click when the press
 *  never moved. Width is committed to the provider on every frame, so the
 *  shell tracks the pointer 1:1 while `isResizing` suppresses its spring. */

'use client';

import { forwardRef, useRef, useState, type HTMLAttributes } from 'react';

import { useShortcutKey, useSidebar, useSidebarInternals } from '@/components/ui/sidebar-context';
import { ShortcutKbd } from '@/components/ui/sidebar-shortcut';
import { Tooltip } from '@/components/ui/tooltip';
import { fontWeights } from '@/lib/font-weight';
import { mergeRefs } from '@/lib/merge-refs';
import { cn } from '@/lib/utils';

/** Drag-resize clamp for the rail handle (px). */
const SIDEBAR_MIN_WIDTH = 160;
const SIDEBAR_MAX_WIDTH = 360;
/** Dragging this far past the minimum width collapses the sidebar instead of
 *  bottoming out — the same "throw it at the edge to dismiss" affordance
 *  native apps use. */
const SIDEBAR_COLLAPSE_SLOP = 56;
/** Pointer travel (px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;

interface DragSession {
  startX: number;
  startWidth: number;
  moved: boolean;
  collapsed: boolean;
}

interface SidebarRailProps extends HTMLAttributes<HTMLButtonElement> {
  /** Pin the tooltip open/closed; `undefined` leaves it on hover. */
  tooltipOpen?: boolean | undefined;
}

/** Rendered by default inside the desktop shell. Its tooltip explains both
 *  gestures with the toggle keystroke, and hovering it brightens the edge
 *  border the shell draws. */
const SidebarRail = forwardRef<HTMLButtonElement, SidebarRailProps>(
  ({ className, tooltipOpen, ...props }, ref) => {
    const { toggleSidebar, setOpen, side } = useSidebar();
    const { setWidth, setIsResizing } = useSidebarInternals();
    const shortcutKey = useShortcutKey();
    const railRef = useRef<HTMLButtonElement | null>(null);
    const dragRef = useRef<DragSession | null>(null);
    const [dragging, setDragging] = useState(false);

    const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      const panel = railRef.current?.closest('[data-slot="sidebar"]') as HTMLElement | null;
      if (!panel) return;
      dragRef.current = {
        startX: event.clientX,
        startWidth: panel.offsetWidth,
        moved: false,
        collapsed: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!drag.moved) {
        drag.moved = true;
        setDragging(true);
        setIsResizing(true);
      }
      const delta = side === 'left' ? dx : -dx;
      const raw = drag.startWidth + delta;
      // Dragged well past the minimum, toward the edge: preview the collapse
      // but keep the drag session alive — pulling back past the threshold
      // re-expands, so an overshoot isn't committed until release.
      if (raw < SIDEBAR_MIN_WIDTH - SIDEBAR_COLLAPSE_SLOP) {
        if (!drag.collapsed) {
          drag.collapsed = true;
          setWidth(`${SIDEBAR_MIN_WIDTH}px`);
          setOpen(false);
        }
        return;
      }
      if (drag.collapsed) {
        drag.collapsed = false;
        setOpen(true);
      }
      const next = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, raw));
      setWidth(`${next}px`);
    };

    const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragging(false);
      setIsResizing(false);
      // A press that never turned into a drag is the collapse click.
      if (drag && !drag.moved) toggleSidebar();
    };

    // A cancelled pointer (touch interruption, capture loss) ends the drag
    // where it stands — no collapse-click, capture is already released.
    const onPointerCancel = () => {
      dragRef.current = null;
      setDragging(false);
      setIsResizing(false);
    };

    const semibold = { fontVariationSettings: fontWeights.semibold };

    return (
      <Tooltip
        side={side === 'left' ? 'right' : 'left'}
        sideOffset={8}
        followCursor="y"
        forceOpen={dragging ? false : tooltipOpen}
        content={
          // The flex column escapes the tooltip surface's text-box trim, so
          // BOTH lines re-apply it and the gap alone carries the line rhythm
          // — an untrimmed line would smuggle its half-leading back in as
          // lopsided padding.
          <span className="flex flex-col items-start gap-2">
            <span className="[text-box:trim-both_cap_alphabetic]">
              <span style={semibold}>Drag</span> to resize
            </span>
            <span className="flex items-center gap-1.5">
              <span className="[text-box:trim-both_cap_alphabetic]">
                <span style={semibold}>Click</span> to collapse
              </span>
              <ShortcutKbd>{shortcutKey}</ShortcutKbd>
            </span>
          </span>
        }
      >
        <button
          ref={mergeRefs(railRef, ref)}
          type="button"
          data-sidebar="rail"
          aria-label="Resize or collapse sidebar"
          tabIndex={-1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className={cn(
            // touch-none: without it the browser claims a touch drag for
            // scrolling and pointercancels the resize mid-gesture.
            'absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none',
            // Positioned from context (not group-data selectors) so variant
            // offsets passed via className can win the merge.
            side === 'left' ? 'right-0' : 'left-0',
            // Hovering brightens the edge border the shell draws by default;
            // a pinned tooltip brightens it too, so the spotlight reads as
            // the hover it stands in for.
            'after:absolute after:inset-y-0 after:w-px after:bg-transparent after:transition-colors after:duration-fast hover:after:bg-foreground/25',
            tooltipOpen && 'after:bg-foreground/25',
            side === 'left' ? 'after:right-0' : 'after:left-0',
            className,
          )}
          {...props}
        />
      </Tooltip>
    );
  },
);
SidebarRail.displayName = 'SidebarRail';

export { SidebarRail };
