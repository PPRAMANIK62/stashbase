/** The collapsed sidebar's peek reveal: the edge strip that arms it and the
 *  floating card that slides out, plus the dismissal rules that keep the card
 *  up while the pointer is really on it.
 *
 *  Peeking never pins the sidebar — the shell stays collapsed underneath and
 *  the card is an overlay. Dismissal is geometric on purpose: a portalled
 *  tooltip or menu covering the card steals the hit-test and fires
 *  pointerleave on the shell even though the cursor never left the sidebar,
 *  so the pointer's position is compared against the overlay's box instead of
 *  trusting enter/leave events. */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, type ReactNode, type RefObject } from 'react';

import {
  useSidebarInternals,
  type SidebarSide,
  type SidebarVariant,
} from '@/components/ui/sidebar-context';
import { useShape } from '@/lib/shape-context';
import { spring } from '@/lib/springs';
import { surfaceClasses } from '@/lib/surface-classes';
import { useSurface, SurfaceProvider } from '@/lib/surface-context';
import { useMotionTier } from '@/lib/use-motion-tier';
import { cn } from '@/lib/utils';

/** How far outside the card's box the pointer may stray before a dismissal
 *  is armed (px) — a little slack around a card the cursor is tracking. */
const PEEK_HIT_SLOP = 8;

interface SidebarPeekProps {
  /** The shell root the card is portal-free-mounted inside; the geometric
   *  watcher measures the card within it and outside presses are tested
   *  against it. */
  shellRef: RefObject<HTMLDivElement | null>;
  side: SidebarSide;
  variant: SidebarVariant;
  /** The pinned rail's width; the card mirrors it less its own gutter, so
   *  pinning from a peek never shifts the rows sideways. */
  width: string;
  children: ReactNode;
}

/** Rendered by the shell in place of the panel while peek is armed: the
 *  collapsed sidebar has no width, so the strip and the card are all there is
 *  to see. */
export function SidebarPeek({ shellRef, side, variant, width, children }: SidebarPeekProps) {
  const { peek, isPeeking, setIsPeeking, schedulePeek, scheduleDismissPeek, cancelPeekTimer } =
    useSidebarInternals();
  const shape = useShape();
  const substrate = useSurface();
  const floatingLevel = Math.min(substrate + 1, 8);
  const settle = useMotionTier(spring.moderate);
  const retract = useMotionTier(spring.moderate.exit);

  useEffect(() => {
    if (!isPeeking) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPeeking(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setIsPeeking(false);
    };
    // Hover mode holds the peek by geometric containment, not enter/leave.
    // Dismissal is armed only when the pointer's position actually crosses
    // out of the overlay's box (with a little margin), and disarmed the
    // moment it crosses back.
    let wasInside = true;
    const onPointerMove = (event: PointerEvent) => {
      const overlay = shellRef.current?.querySelector('[data-sidebar="peek"]') ?? shellRef.current;
      if (!overlay) return;
      const box = overlay.getBoundingClientRect();
      const inside =
        event.clientX >= box.left - PEEK_HIT_SLOP &&
        event.clientX <= box.right + PEEK_HIT_SLOP &&
        event.clientY >= box.top - PEEK_HIT_SLOP &&
        event.clientY <= box.bottom + PEEK_HIT_SLOP;
      if (inside) {
        // Unconditional (not transition-gated): another surface's leave —
        // the hover-peek trigger's, say — may have armed a dismissal while
        // the pointer was already inside the box.
        wasInside = true;
        cancelPeekTimer();
      } else if (wasInside) {
        wasInside = false;
        scheduleDismissPeek();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    if (peek === 'hover') document.addEventListener('pointermove', onPointerMove);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
    };
  }, [shellRef, isPeeking, setIsPeeking, peek, cancelPeekTimer, scheduleDismissPeek]);

  const offscreen = side === 'left' ? '-108%' : '108%';

  return (
    <>
      {/* Edge strip: the collapsed sidebar's reveal affordance. A thin
          hairline brightens on hover; hover mode peeks after a short
          intent delay, click mode on press. */}
      <button
        type="button"
        aria-label="Peek sidebar"
        aria-expanded={isPeeking}
        className={cn(
          'group/peek-strip absolute inset-y-0 z-40 w-3 cursor-pointer outline-none',
          side === 'left' ? 'left-0' : 'right-0',
        )}
        onPointerEnter={
          peek === 'hover'
            ? (event) => {
                if (event.pointerType === 'mouse') schedulePeek();
              }
            : undefined
        }
        onClick={() => {
          cancelPeekTimer();
          setIsPeeking(true);
        }}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0 w-px bg-border opacity-0 transition-opacity duration-fast group-hover/peek-strip:opacity-100 group-focus-visible/peek-strip:opacity-100',
            side === 'left' ? 'left-0' : 'right-0',
          )}
        />
      </button>
      <AnimatePresence>
        {isPeeking && (
          <motion.div
            data-sidebar="peek"
            className={cn(
              'absolute inset-y-2 z-50 flex flex-col overflow-hidden',
              // The card's edge inset matches where the PINNED rail's
              // content sits, so pinning from a peek never shifts the
              // rows sideways: floating pins into a card inset by the
              // same gutter; inset/sidebar pin flush to the edge.
              side === 'left'
                ? variant === 'floating'
                  ? 'left-2'
                  : 'left-0'
                : variant === 'floating'
                  ? 'right-2'
                  : 'right-0',
              shape.container,
              surfaceClasses(floatingLevel, 3),
            )}
            style={{ width: `calc(${width} - ${variant === 'floating' ? '1rem' : '0.5rem'})` }}
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen, transition: retract }}
            transition={settle}
          >
            <SurfaceProvider value={floatingLevel}>{children}</SurfaceProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
