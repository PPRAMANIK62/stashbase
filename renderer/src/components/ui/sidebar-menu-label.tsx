/** What sits inside a menu row's button: its leading icon and its label.
 *
 *  Both are shared by the parent rows and the sub rows, and both carry the
 *  same "lit" treatment — the row's colour and weight step up together when it
 *  is hovered or current, so a row never half-lights.
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

/** The row's leading glyph. Normalized to the size ladder's icon size, and
 *  thickened with the rest of the row when it is lit. */
export function RowIcon({
  icon: Icon,
  lit,
  size,
}: {
  icon: IconComponent;
  lit: boolean;
  size: number;
}) {
  return (
    <Icon
      size={size}
      strokeWidth={lit ? 2 : 1.5}
      className={cn(
        'shrink-0 transition-[color,stroke-width] duration-fast',
        lit ? 'text-foreground' : 'text-muted-foreground',
      )}
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
  lit,
  emphasized,
  textClass,
}: {
  label: React.ReactNode;
  extras: React.ReactNode;
  lit: boolean;
  emphasized: boolean;
  textClass: string;
}) {
  if (label === undefined || label === null || label === '') {
    return (
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 transition-colors duration-fast',
          lit ? 'text-foreground' : 'text-muted-foreground',
          textClass,
        )}
      >
        {extras}
      </span>
    );
  }

  return (
    <>
      <WeightedLabel
        className={cn('min-w-0 text-left', textClass)}
        emphasized={emphasized}
        lit={lit}
        overflow="truncate"
      >
        {label}
      </WeightedLabel>
      {extras}
    </>
  );
}
