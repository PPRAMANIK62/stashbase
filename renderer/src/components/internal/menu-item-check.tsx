/** The selection checkmark drawn on a chosen row, shared by MenuItem and
 *  SelectItem. The stroke draws itself in on the way in and unwrites itself on
 *  the way out; the surrounding opacity is pinned at 1 so the path length,
 *  not a fade, is the whole animation. */
'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { tween } from '@/lib/springs';
import { useMotionTier } from '@/lib/use-motion-tier';

interface MenuItemCheckProps {
  /** Whether the row is selected. */
  checked: boolean;
  /** Edge length in px, from the surrounding size step. */
  size: number;
  className?: string;
  /** Skips the draw on the row's very first render, so a menu that opens on
   *  an existing selection shows it already marked instead of writing it in.
   *  @default false */
  skipAnimation?: boolean;
}

export function MenuItemCheck({
  checked,
  className,
  size,
  skipAnimation = false,
}: MenuItemCheckProps) {
  const draw = useMotionTier({ ...tween.fast, ease: 'easeOut' } as const);
  const unwrite = useMotionTier({ ...tween.snap, ease: 'easeIn' } as const);
  return (
    <AnimatePresence>
      {checked && (
        <motion.svg
          key="check"
          animate={{ opacity: 1 }}
          className={className}
          exit={{ opacity: 1 }}
          fill="none"
          height={size}
          initial={{ opacity: 1 }}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
          width={size}
        >
          <motion.path
            animate={{
              pathLength: 1,
              transition: draw,
            }}
            d="M4 12L9 17L20 6"
            exit={{
              pathLength: 0,
              transition: unwrite,
            }}
            initial={{ pathLength: skipAnimation ? 1 : 0 }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}
