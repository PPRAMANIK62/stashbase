import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/common/lib/utils';

/**
 * A small standing label on a row or card — "BETA", "LOCAL", a status word.
 * Tonal variants come off the status ramp so a badge never invents a colour.
 *
 * `rounded-xs` on purpose: a badge is an inline run of text, not a box.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-xs border px-1.5 py-0.5 text-2xs font-semibold tracking-wider whitespace-nowrap uppercase',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-background text-muted-foreground',
        info: 'border-status-info/30 bg-background text-status-info',
        success: 'border-status-success/30 bg-background text-status-success',
        warning: 'border-status-warning/30 bg-background text-status-warning',
        danger: 'border-status-danger/30 bg-background text-status-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
