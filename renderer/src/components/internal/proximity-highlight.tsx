/** The moving background behind whichever row the pointer is nearest.
 *
 *  Several list primitives (the command palette, the table) share one hover
 *  affordance: instead of each row painting its own background, the container
 *  draws a single absolutely-positioned block and springs it between the
 *  measured rows, so the highlight reads as one object travelling down the
 *  list rather than a set of rows blinking in turn.
 *
 *  `session` is what makes a re-entry look right. `useProximityHover` bumps it
 *  every time the pointer leaves and comes back, and it is used as the React
 *  key, so a new session mounts a fresh block that fades in where the pointer
 *  actually is — rather than sliding in from wherever the pointer left. */

'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { spring, tween } from '@/lib/springs';
import { useMotionTier } from '@/lib/use-motion-tier';
import type { ItemRect } from '@/lib/use-proximity-hover';
import { cn } from '@/lib/utils';

interface ProximityHighlightProps {
  /** The nearest row's measured box, or null/undefined while the pointer is
   *  outside the container or the rows have not been measured yet. */
  rect: ItemRect | null | undefined;
  /** `sessionRef.current` from `useProximityHover`. */
  session: number;
  /** The block's own look — tint and radius. The positioning and the motion
   *  are this component's; the surface is the caller's. */
  className?: string;
}

function ProximityHighlight({ rect, session, className }: ProximityHighlightProps) {
  const settle = useMotionTier({ ...spring.fast, opacity: tween.fast });
  const fadeOut = useMotionTier(spring.fast.exit);
  const box = rect
    ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
    : null;

  return (
    <AnimatePresence>
      {box && (
        <motion.div
          key={session}
          aria-hidden="true"
          className={cn('pointer-events-none absolute', className)}
          initial={{ opacity: 0, ...box }}
          animate={{ opacity: 1, ...box }}
          exit={{ opacity: 0, transition: fadeOut }}
          transition={settle}
        />
      )}
    </AnimatePresence>
  );
}

export { ProximityHighlight };
