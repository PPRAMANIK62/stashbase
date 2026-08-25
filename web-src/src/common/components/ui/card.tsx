import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/common/lib/utils';

/**
 * A bordered surface holding related content — a settings row, a callout,
 * a result group. A BOX in the corner language, so it always takes the
 * container radius no matter how tall it is.
 */
const cardVariants = cva('rounded-lg border border-border', {
  variants: {
    surface: {
      /** Paper: sits on chrome and reads as content. */
      base: 'bg-background',
      /** Chrome: sits on paper and reads as a recessed panel. */
      sunken: 'bg-pane',
      /** Raised: a step above paper. Identical to base in the light theme
       * and a real step in dark, which is the whole job of the role. */
      raised: 'bg-card',
    },
  },
  defaultVariants: { surface: 'base' },
});

function Card({
  className,
  surface,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return (
    <div data-slot="card" className={cn(cardVariants({ surface }), className)} {...props} />
  );
}

export { Card, cardVariants };
