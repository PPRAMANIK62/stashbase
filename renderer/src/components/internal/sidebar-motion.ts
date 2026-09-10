/** The framer-motion prop seam shared by every sidebar surface that renders a
 *  `motion.div` from a primitive's render payload.
 *
 *  framer redefines six DOM props with incompatible signatures — the drag and
 *  animation lifecycle handlers — and it owns `style`, which accepts
 *  MotionValues and transform shorthands React's `CSSProperties` cannot
 *  express. A payload handed over by Base UI must therefore be narrowed before
 *  it is spread onto a motion element, and the motion element supplies its own
 *  `style` afterwards. */

import type { MotionStyle } from 'framer-motion';
import type { HTMLAttributes } from 'react';

/** A div's props minus everything framer-motion redefines. */
export type MotionSafeDivProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'style'
> & {
  /** motion owns `style`: it accepts MotionValues and transform shorthands
   *  that React's CSSProperties cannot express. */
  style?: MotionStyle;
};

/** Drops the `style` a render payload carries so the rest of it can be spread
 *  onto a `motion.div` that declares its own. */
export function motionSafeProps(props: HTMLAttributes<HTMLDivElement>): MotionSafeDivProps {
  const { style: _style, ...rest } = props;
  return rest;
}
