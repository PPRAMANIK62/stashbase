/**
 * The tree's two pieces of motion: the group that opens and closes under a
 * folder, and the single highlight that follows the pointer across rows.
 *
 * Both are presentational. The tree hands them geometry and a settle callback
 * and never reads back from them, so nothing about focus or selection depends
 * on an animation having finished.
 */
import { motion, useIsPresent } from 'framer-motion';
import { useState, type ReactNode } from 'react';

import { spring, tween } from '@/lib/springs';
import { cn } from '@/lib/utils';

export interface TreeGroupProps {
  children: ReactNode;
  onSettle(): void;
  reduceMotion: boolean;
}

/**
 * The children of an expanded folder. The group springs open from the folder
 * row and closes back into it; while it is leaving, its rows are inert and
 * skipped by the proximity layer so nothing stale can be reached. Clipping
 * applies only while the height moves, so a row's focus ring is never shaved
 * once the group has settled.
 */
export function TreeGroup({ children, onSettle, reduceMotion }: TreeGroupProps) {
  const present = useIsPresent();
  const [moving, setMoving] = useState(false);
  return (
    <motion.div
      animate={{ height: 'auto', opacity: 1 }}
      aria-hidden={present ? undefined : true}
      className={moving || !present ? 'overflow-hidden' : undefined}
      data-tree-exiting={present ? undefined : ''}
      exit={{
        height: 0,
        opacity: 0,
        transition: reduceMotion ? { duration: 0 } : spring.moderate.exit,
      }}
      inert={!present}
      initial={{ height: 0, opacity: 0 }}
      onAnimationComplete={() => {
        setMoving(false);
        onSettle();
      }}
      onAnimationStart={() => setMoving(true)}
      transition={reduceMotion ? { duration: 0 } : { ...spring.moderate, opacity: tween.fast }}
    >
      {children}
    </motion.div>
  );
}

interface TreeProximityRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface TreeProximityHighlightProps {
  className: string;
  rect: TreeProximityRect;
  reduceMotion: boolean;
}

/** The one hover surface, glided between rows rather than drawn per row. */
export function TreeProximityHighlight({
  className,
  rect,
  reduceMotion,
}: TreeProximityHighlightProps) {
  return (
    <motion.div
      animate={{ ...rect, opacity: 1 }}
      aria-hidden="true"
      className={cn('pointer-events-none absolute bg-hover', className)}
      data-tree-proximity=""
      exit={{ opacity: 0, transition: spring.fast.exit }}
      initial={{ ...rect, opacity: 0 }}
      transition={
        reduceMotion
          ? { duration: 0, opacity: tween.fast }
          : { ...spring.fast, opacity: tween.fast }
      }
    />
  );
}
