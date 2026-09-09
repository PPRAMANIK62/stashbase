/** A label that thickens without moving anything.
 *
 *  Selection, hover and expansion all step a label from normal to semibold in
 *  this kit, and a bolder label is a wider one: animate the weight naively and
 *  every glyph after it — a trailing count, a chevron, the next tab — slides.
 *  So the label is drawn twice in one grid cell: an invisible copy pinned at
 *  the heavy weight reserves the width, and the visible copy animates inside
 *  the box that copy already claimed.
 *
 *  Five surfaces wanted that (menu rows, sidebar rows, card titles, tab
 *  labels, the reasoning trace's disclosure) and five of them wrote it out,
 *  drifting on the details that are easy to get wrong: which layer is hidden
 *  from assistive technology, whether both layers clip the same way, and the
 *  padding that keeps a truncating clip box from shaving the ascenders the
 *  text-box trim excludes. It is written here once instead.
 *
 *  Text only. Anything that is not part of the label — a status dot, a
 *  trailing control — belongs beside this element, not inside it: the ghost
 *  copy would render it twice and the trimmed box would clip an inline SVG. */

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { fontWeights } from '@/lib/font-weight';
import { cn } from '@/lib/utils';

/** What the label does when it is wider than the box it is given.
 *
 *  `none`     — nothing; the label wraps as text normally would.
 *  `nowrap`   — one line, allowed to overflow (a tab in a scrolling strip).
 *  `wrap`     — breaks inside long words rather than overflowing.
 *  `truncate` — one line, clipped with an ellipsis.
 *  `ellipsis` — clipped with an ellipsis while still allowed to wrap; the
 *               grid track is clamped so the ellipsis lands inside the box. */
type WeightedLabelOverflow = 'none' | 'nowrap' | 'wrap' | 'truncate' | 'ellipsis';

interface WeightedLabelProps extends HTMLAttributes<HTMLSpanElement> {
  /** The label text. Rendered twice — once invisibly — so keep it text. */
  children: ReactNode;
  /** Draws the visible copy at the heavy weight. */
  emphasized: boolean;
  /** The visible copy's colour: `true` reads as foreground, `false` as
   *  muted-foreground, omitted inherits so the caller can pin its own. */
  lit?: boolean;
  /** @default "none" */
  overflow?: WeightedLabelOverflow;
  /** Trim the text box to cap height and baseline, so the label centres
   *  optically inside a fixed-height row. @default true */
  trim?: boolean;
}

/** The trimmed box ends at the cap line and the baseline, so a clip box drawn
 *  on it would shave ascenders and descenders. Symmetric padding pushes the
 *  clip past both and the matching negative margin takes it back out of the
 *  row's height. */
const CLIP_BLEED = '-my-[0.3em] py-[0.3em]';

const TRIM = '[text-box:trim-both_cap_alphabetic]';

const overflowCell: Record<WeightedLabelOverflow, string> = {
  none: '',
  nowrap: '',
  wrap: 'break-words whitespace-normal',
  truncate: 'truncate',
  ellipsis: 'min-w-0 overflow-hidden text-ellipsis',
};

const WeightedLabel = forwardRef<HTMLSpanElement, WeightedLabelProps>(
  ({ children, emphasized, lit, overflow = 'none', trim = true, className, ...props }, ref) => {
    // Both stacked copies carry the same trim and the same clipping rule, or
    // the sizer and the label keep different boxes and the reservation stops
    // being a reservation.
    const cell = cn(
      'col-start-1 row-start-1',
      trim && TRIM,
      overflowCell[overflow],
      overflow === 'truncate' && trim && CLIP_BLEED,
    );

    return (
      <span
        ref={ref}
        className={cn(
          'inline-grid',
          overflow === 'nowrap' && 'whitespace-nowrap',
          // Clamps the implicit track to the clipped box's width, so an
          // ellipsis falls inside what the reader can see.
          overflow === 'ellipsis' && 'grid-cols-[minmax(0,1fr)]',
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn('invisible', cell)}
          style={{ fontVariationSettings: fontWeights.semibold }}
        >
          {children}
        </span>
        <span
          className={cn(
            'transition-[color,font-variation-settings] duration-fast',
            cell,
            lit === undefined ? '' : lit ? 'text-foreground' : 'text-muted-foreground',
          )}
          style={{
            fontVariationSettings: emphasized ? fontWeights.semibold : fontWeights.normal,
          }}
        >
          {children}
        </span>
      </span>
    );
  },
);

WeightedLabel.displayName = 'WeightedLabel';

export { WeightedLabel };
