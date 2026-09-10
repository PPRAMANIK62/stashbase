/** The expanded/collapsed desktop rail: an in-flow sticky column that
 *  animates its width (this is what reflows the inset) while the fixed-width
 *  panel inside slides out under overflow clipping — container-relative, so
 *  the whole sidebar works inside any bounded frame, not just the viewport.
 *
 *  The shell stays MOUNTED across the drawer breakpoint and dissolves instead
 *  of unmounting, which used to snap the rail away the instant the window
 *  shrank. It also arbitrates the three ways its width can change — the
 *  open/close spring, a 1:1 drag, and the flips a drag can cause mid-gesture
 *  — because each needs a different transition on the very commit that
 *  changes the target. */

'use client';

import { motion } from 'framer-motion';
import { forwardRef, useEffect, useRef, useState, type CSSProperties } from 'react';

import type { MotionSafeDivProps } from '@/components/internal/sidebar-motion';
import {
  sidebarLandmarkLabel,
  useSidebar,
  useSidebarInternals,
  type SidebarSide,
  type SidebarVariant,
} from '@/components/ui/sidebar-context';
import { SidebarPeek } from '@/components/ui/sidebar-peek';
import { SidebarRail } from '@/components/ui/sidebar-rail';
import { mergeRefs } from '@/lib/merge-refs';
import { useShape } from '@/lib/shape-context';
import { spring, exitFallbackMs } from '@/lib/springs';
import { surfaceClasses } from '@/lib/surface-classes';
import { useSurface, SurfaceProvider } from '@/lib/surface-context';
import { instant, useMotionTier } from '@/lib/use-motion-tier';
import { cn } from '@/lib/utils';

// Crossing the drawer breakpoint DISSOLVES the desktop rail instead of
// snapping it away: opacity fades while `display` rides the same transition
// with allow-discrete, so none applies only once the fade lands (and
// @starting-style fades it back in when the window grows). Literal classes
// per breakpoint — Tailwind's scanner can't see composed strings — so for the
// standard breakpoints the shell is also hidden by CSS, avoiding a
// pre-hydration flash of the rail on small screens. Non-standard breakpoints
// fall back to a JS-driven `hidden` (no dissolve, but never rail + drawer at
// once).
const BREAKPOINT_FADE_BASE =
  'transition-[opacity,display] ease-out [transition-behavior:allow-discrete] motion-reduce:transition-none';
const BREAKPOINT_HIDDEN: Record<number, string> = {
  640: 'max-sm:hidden max-sm:opacity-0 max-sm:duration-base sm:duration-slow sm:starting:opacity-0',
  768: 'max-md:hidden max-md:opacity-0 max-md:duration-base md:duration-slow md:starting:opacity-0',
  1024: 'max-lg:hidden max-lg:opacity-0 max-lg:duration-base lg:duration-slow lg:starting:opacity-0',
  1280: 'max-xl:hidden max-xl:opacity-0 max-xl:duration-base xl:duration-slow xl:starting:opacity-0',
};

/** The rail hairline's fade window, keyed off the shape system's radius: on a
 *  vertically inset card the hover line must be transparent through the
 *  corner radius and fade in over the straight run below it. */
const railFadeVars = (bgRadius: number): CSSProperties => {
  const start = bgRadius >= 20 ? 24 : 12;
  return {
    '--rail-fade-start': `${start}px`,
    '--rail-fade-end': `${start + 24}px`,
  } as CSSProperties;
};

interface SidebarShellProps extends MotionSafeDivProps {
  side: SidebarSide;
  variant: SidebarVariant;
  /** The `sidebar` variant's inner-edge border. Default true. */
  bordered?: boolean;
  /** Render the built-in resize/collapse rail handle. `false` hides it and
   *  disables drag-resize — the trigger and keyboard shortcut still toggle. */
  rail?: boolean;
  /** Pin the rail's tooltip open (`true`) or closed (`false`); `undefined`
   *  leaves it on hover. Dragging always hides it. */
  railTooltipOpen?: boolean | undefined;
}

const SidebarShell = forwardRef<HTMLDivElement, SidebarShellProps>(
  (
    { side, variant, bordered = true, rail = true, railTooltipOpen, className, children, ...props },
    ref,
  ) => {
    const { open, width, isMobile } = useSidebar();
    const { mobileBreakpoint, isResizing, peek, isPeeking, cancelPeekTimer } =
      useSidebarInternals();
    const shape = useShape();
    const shellRef = useRef<HTMLDivElement | null>(null);
    const substrate = useSurface();
    const floatingLevel = Math.min(substrate + 1, 8);

    // `!isResizing`: a drag can preview the collapsed state mid-gesture; the
    // shell must not swap to the peek strip then, or it would unmount the
    // rail holding the pointer capture and kill the drag.
    const peekEnabled = peek !== 'none' && !open && !isResizing;

    // Drag-resize needs the panel glued to the pointer; the spring resumes
    // for open/close. Reduced motion snaps instead of sliding — the state
    // change stays legible without the 256px of travel. The open/close ride
    // the SLOW tier: a whole column moving is the largest thing this
    // component animates (the sheet and peek stay on moderate — drawers
    // settle precisely, per the tier notes).
    const landmarkLabel = props['aria-label'] ?? sidebarLandmarkLabel(side);
    const dragSettle = useMotionTier(spring.moderate);
    const dragRetract = useMotionTier(spring.moderate.exit);
    const toggleSettle = useMotionTier(spring.slow);
    const toggleRetract = useMotionTier(spring.slow.exit);
    // Mid-drag open flips — the collapse preview and its drag-back rescue —
    // ride the moderate tier instead of the drag's glued zero-duration tracking.
    // The flip is detected synchronously (transition must be right on the
    // very commit whose animate target changes; effects run too late), then
    // `dragFlip` holds the spring through its settle so pointer moves landing
    // right after a flip retarget the spring instead of snapping.
    const [dragFlip, setDragFlip] = useState(false);
    const prevOpenRef = useRef(open);
    const openFlipped = prevOpenRef.current !== open;
    // Pinning open from an active peek: the panel is already fully on screen
    // as the overlay card, so while the width spring makes room the shell
    // must not clip — otherwise the visible sidebar wipes in from a mask it
    // never left. Detected synchronously (the provider clears isPeeking an
    // effect later); the state hold keeps the clip off through the spring.
    const [pinFromPeekHold, setPinFromPeekHold] = useState(false);
    const pinnedFromPeek = (openFlipped && open && isPeeking) || pinFromPeekHold;
    useEffect(() => {
      if (!(open && isPeeking)) return;
      setPinFromPeekHold(true);
      const id = setTimeout(() => setPinFromPeekHold(false), exitFallbackMs(spring.slow));
      return () => clearTimeout(id);
    }, [open, isPeeking]);
    useEffect(() => {
      const flipped = prevOpenRef.current !== open;
      prevOpenRef.current = open;
      if (!isResizing) {
        setDragFlip(false);
        return;
      }
      if (!flipped) return;
      setDragFlip(true);
      const id = setTimeout(() => setDragFlip(false), exitFallbackMs(spring.moderate));
      return () => clearTimeout(id);
    }, [open, isResizing]);
    // Four landings, one rule: a drag that has flipped past its threshold
    // settles on the moderate tier, a drag still tracking the pointer snaps,
    // and a plain toggle takes the slow tier.
    const widthTransition = isResizing
      ? openFlipped || dragFlip
        ? open
          ? dragSettle
          : dragRetract
        : instant
      : open
        ? toggleSettle
        : toggleRetract;

    return (
      <motion.div
        ref={mergeRefs(shellRef, ref)}
        data-slot="sidebar"
        data-state={open ? 'expanded' : 'collapsed'}
        data-collapsible={open ? '' : 'offcanvas'}
        data-variant={variant}
        data-side={side}
        className={cn(
          // No bare `group` here: an unnamed group on the whole rail would
          // fire every descendant's group-hover (Button fills, icon strokes)
          // on rail hover. Named groups (menu-item etc.) handle row states.
          'peer sticky top-0 h-svh shrink-0',
          // While peek is armed the 0-width shell must not clip the edge
          // strip or the overlay card — and the shell must rise above the
          // inset (a later sibling) so the card paints over it. Pinning from
          // a peek keeps both through the width spring for the same reason.
          peekEnabled || pinnedFromPeek ? 'z-40' : 'overflow-hidden',
          // Flex order (not DOM order) decides the side, so consumers can
          // keep Sidebar before SidebarInset regardless of `side`.
          side === 'right' && 'order-last',
          // The inset rail has no card edge of its own, so its scroll hairline
          // hugs the rows' 8px gutter instead of running panel-wide.
          variant === 'inset' && '[--scroll-divider-inset:8px]',
          BREAKPOINT_FADE_BASE,
          BREAKPOINT_HIDDEN[mobileBreakpoint],
          // A non-standard breakpoint has no literal utility in the map, so
          // JS hides the shell (no fade, but never rail + drawer at once).
          !BREAKPOINT_HIDDEN[mobileBreakpoint] && isMobile && 'hidden',
          className,
        )}
        initial={false}
        animate={{ width: open ? width : '0rem' }}
        transition={widthTransition}
        // Hover-mode dismissal lives on the shell root: the pointer can land
        // on the overlay without ever crossing it (the card slides in under
        // a stationary cursor), so per-element leave events are unreliable —
        // leaving the shell subtree is the signal that matters.
        onPointerEnter={peekEnabled && peek === 'hover' ? cancelPeekTimer : undefined}
        // While PEEKED, dismissal belongs to the peek's geometric watcher —
        // leave events lie whenever portalled content (tooltip, menu) covers
        // the card. This leave handler only retires a pending peek-arm when
        // the cursor departs before the intent delay lands.
        onPointerLeave={
          peekEnabled && peek === 'hover'
            ? () => {
                if (!isPeeking) cancelPeekTimer();
              }
            : undefined
        }
        {...props}
      >
        {peekEnabled ? (
          <SidebarPeek shellRef={shellRef} side={side} variant={variant} width={width}>
            {children}
          </SidebarPeek>
        ) : (
          <motion.div
            className={cn(
              'absolute inset-y-0 flex h-full flex-col',
              side === 'left' ? 'left-0' : 'right-0',
              // Floating floats its card inside a full gutter; inset only needs
              // the vertical inset (horizontal room belongs to the nav rows).
              variant === 'floating' && 'p-2',
              variant === 'inset' && 'py-2',
            )}
            style={{ width }}
            initial={false}
            animate={{ x: open ? '0%' : side === 'left' ? '-100%' : '100%' }}
            transition={widthTransition}
          >
            {variant === 'floating' ? (
              <aside
                aria-label={landmarkLabel}
                data-sidebar="sidebar"
                className={cn(
                  'flex h-full min-h-0 w-full flex-col',
                  shape.container,
                  surfaceClasses(floatingLevel, 3),
                )}
              >
                <SurfaceProvider value={floatingLevel}>{children}</SurfaceProvider>
              </aside>
            ) : (
              <aside
                aria-label={landmarkLabel}
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
            )}
            {rail && (
              <SidebarRail
                tooltipOpen={railTooltipOpen}
                className={cn(
                  // The floating card sits inside the panel's p-2 gutter, so the
                  // grab strip (and its hover hairline) moves in to straddle the
                  // card's edge instead of the panel's.
                  variant === 'floating' &&
                    (side === 'left' ? 'right-1 after:right-[3.5px]' : 'left-1 after:left-[3.5px]'),
                  // Cards are vertically inset and rounded — the hover hairline
                  // hugs the card's straight run: fully transparent through the
                  // corner radius, then fading in over 24px (mirrored at the
                  // bottom). The radius rides the shape system via CSS vars.
                  variant !== 'sidebar' &&
                    'after:inset-y-2 after:[mask-image:linear-gradient(to_bottom,transparent_var(--rail-fade-start),black_var(--rail-fade-end),black_calc(100%-var(--rail-fade-end)),transparent_calc(100%-var(--rail-fade-start)))]',
                )}
                style={variant !== 'sidebar' ? railFadeVars(shape.bgRadius) : undefined}
              />
            )}
          </motion.div>
        )}
      </motion.div>
    );
  },
);
SidebarShell.displayName = 'SidebarShell';

export { SidebarShell };
