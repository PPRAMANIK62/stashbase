import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/common/lib/utils';

/**
 * The muted "nothing here" body — a loading fallback, a no-matches
 * notice, an empty list. Four recipes said this once each, at three type
 * sizes and four paddings, so the same sentence changed size depending on
 * which surface you reached it from.
 *
 * `text-sm` is the size, and it is a CHOICE rather than the default the
 * viewers had. `text-base` is 13px — the ambient `--ui-font-size` — which
 * is what any block gets for saying nothing about its type at all. An
 * empty state reports that content is missing, so it sits one step below
 * the body text it stands in for instead of at parity with the document
 * it is standing in for.
 *
 * The two layouts are a real split, not a padding preference: one is a
 * line in someone else's list, the other is the whole of an empty pane.
 */
const emptyStateVariants = cva('text-sm text-muted-foreground', {
  variants: {
    layout: {
      /** A row in a list — a picker's result list, a menu, a tree. It is
       * one line in a stack of lines, so it takes the list's own
       * horizontal padding and never claims a height. `cursor-default`
       * because it sits among rows that are pressable and this one is
       * not. */
      row: 'flex cursor-default justify-center px-2.5 py-4',
      /** Fills the host cell and centres on both axes — the lazy viewer
       * fallbacks, where there is no list to sit in, only an empty pane.
       * A message pinned to the pane's top-left corner reads as content
       * that failed to lay out rather than as a placeholder.
       * `place-content-center` is load-bearing for multi-child states:
       * grid's default `align-content: stretch` splits a tall pane's
       * spare height evenly between the auto rows, scattering an
       * icon-title-action stack down the pane; packing the rows first
       * keeps the stack one cluster (and lets a `gap-*` mean what it
       * says) while a single-child fallback renders identically. */
      fill: 'grid h-full place-content-center place-items-center p-4 text-center',
    },
  },
  defaultVariants: { layout: 'row' },
});

function EmptyState({
  className,
  layout,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyStateVariants>) {
  return (
    <div data-slot="empty-state" className={cn(emptyStateVariants({ layout }), className)} {...props} />
  );
}

export { EmptyState, emptyStateVariants };
