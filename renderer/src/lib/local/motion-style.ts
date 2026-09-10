import type { MotionStyle } from 'framer-motion';
import type { CSSProperties } from 'react';

/** framer-motion owns six properties that CSS also declares — `x`, `y`,
 *  `rotate`, `scale`, `perspective` and `translate`'s siblings — and it
 *  re-declares them without an explicit `undefined`. csstype spells every
 *  property as `| undefined`, so a plain `CSSProperties` value (what Base UI
 *  hands a render prop) cannot be spread into a motion `style` under
 *  `exactOptionalPropertyTypes`. Re-attach those keys only when they carry a
 *  value, leaving every other declaration untouched. */
export function motionStyle(base: CSSProperties | undefined): MotionStyle {
  if (!base) return {};
  const { x, y, rotate, scale, perspective, ...rest } = base;
  return {
    ...rest,
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
    ...(rotate === undefined ? {} : { rotate }),
    ...(scale === undefined ? {} : { scale }),
    ...(perspective === undefined ? {} : { perspective }),
  };
}
