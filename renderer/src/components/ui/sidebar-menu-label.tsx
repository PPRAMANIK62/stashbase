/** What sits inside a menu row's button: its leading icon and its label.
 *
 *  Both are shared by the parent rows and the sub rows. A row rests in ink,
 *  label and glyph alike, the way a chat client's sidebar does; hover and
 *  selection add the row tint and nothing else, so neither colour nor
 *  stroke nor weight changes, and a current row looks exactly like a
 *  hovered one. Grey is for glyphs that stand alone as buttons, which
 *  darken under their own pointer.
 *
 *  The label is named, not guessed. This module used to read the row's
 *  children and peel the leading string off the front as "the label", which
 *  made a row's typography depend on the shape of its JSX: a row whose title
 *  arrived as `{name}` got the weight treatment and one whose title arrived
 *  inside a span silently did not. The row now takes `label` explicitly, and
 *  `extras` is whatever rides beside it — a status dot, a badge, a trailing
 *  control that `ml-auto` pushes to the end. */

'use client';

import { WeightedLabel } from '@/components/ui/weighted-label';
import type { IconComponent } from '@/lib/icon-context';
import { cn } from '@/lib/utils';

/** The row's leading glyph. Normalized to the size ladder's icon size, in
 *  the same ink as the label beside it, so a row is one colour. */
export function RowIcon({ icon: Icon, size }: { icon: IconComponent; size: number }) {
  return (
    <Icon
      size={size}
      strokeWidth={1.5}
      className={cn('shrink-0 transition-colors duration-fast', 'text-foreground')}
    />
  );
}

/** The row's title, and whatever rides beside it.
 *
 *  `extras` render as flex siblings AFTER the label — outside the
 *  text-box-trimmed span, which would clip an inline SVG, and where `ml-auto`
 *  can push a trailing control to the row's end. A row with no `label` (one
 *  hosting an inline rename field, say) renders its extras alone in the row's
 *  own colour. */
export function MenuRowLabel({
  label,
  extras,
  textClass,
}: {
  label: React.ReactNode;
  extras: React.ReactNode;
  textClass: string;
}) {
  if (label === undefined || label === null || label === '') {
    return (
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 transition-colors duration-fast',
          'text-foreground',
          textClass,
        )}
      >
        {extras}
      </span>
    );
  }

  return (
    <>
      {/* The label pins ink rather than handing WeightedLabel a lit state: a
       *  lit label would otherwise rest muted, and a row's colour never
       *  changes under the pointer. */}
      <WeightedLabel
        className={cn('min-w-0 text-left text-foreground', textClass)}
        emphasized={false}
        overflow="truncate"
      >
        {label}
      </WeightedLabel>
      {extras}
    </>
  );
}
