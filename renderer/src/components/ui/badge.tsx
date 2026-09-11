'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';

import { useShape } from '@/lib/shape-context';
import { useSize, type SizeVariant } from '@/lib/size-context';
import { cn } from '@/lib/utils';

/** One hue per thing a badge is ever saying, and nothing beyond that.
 *
 *  This was a seventeen-colour palette — the whole Tailwind wheel, orange
 *  through rose — of which five were ever asked for. A colour with no caller
 *  is not a choice a designer gets to make later; it is a token in globals.css
 *  that nothing reads and a name a reader has to rule out. `gray` is the
 *  neutral default; the other four are the states the product actually
 *  reports. */
const badgeColors = {
  gray: 'var(--badge-gray)',
  /** Failed, blocked, rejected. */
  red: 'var(--badge-red)',
  /** Something needs attention but nothing is broken. */
  amber: 'var(--badge-amber)',
  /** Informational — a source, a kind, a label that classifies. */
  blue: 'var(--badge-blue)',
  /** Ready, complete, healthy. */
  green: 'var(--badge-green)',
} as const;

type BadgeColor = keyof typeof badgeColors;

// The box and the dot come from the shared ladder (`badge`, `badgeDot`,
// `caption` in lib/size-context) rather than a second two-entry map here.
const badgeVariants = cva('inline-flex items-center font-medium whitespace-nowrap', {
  variants: {
    variant: {
      solid: '',
      dot: 'border border-border text-foreground',
    },
  },
  defaultVariants: {
    variant: 'solid',
  },
});

interface BadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'>, VariantProps<typeof badgeVariants> {
  color?: BadgeColor;
  /** Omitted, the badge follows the surrounding SizeProvider. */
  size?: SizeVariant;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { className, variant = 'solid', size: sizeProp, color = 'gray', children, style, ...props },
    ref,
  ) => {
    const shape = useShape();
    // Resolve the size: explicit prop > surrounding SizeProvider > default.
    const sizeClasses = useSize(sizeProp);
    const colorValue = badgeColors[color];
    const isSolid = variant === 'solid';

    const colorStyle = isSolid
      ? color === 'gray'
        ? // A gray badge classifies rather than alerts, so it sits on the muted
          // surface in muted ink and reads a step quieter than a control.
          { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
        : {
            color: 'var(--foreground)',
            backgroundColor: `color-mix(in srgb, ${colorValue} 15%, var(--background))`,
          }
      : {};

    const dotColor = color === 'gray' ? 'var(--muted-foreground)' : colorValue;

    return (
      <span
        ref={ref}
        className={cn(
          badgeVariants({ variant }),
          sizeClasses.badge,
          sizeClasses.caption,
          shape.item,
          className,
        )}
        style={{ ...colorStyle, ...style }}
        {...props}
      >
        {!isSolid && (
          <span
            className="shrink-0 rounded-full"
            style={{
              width: sizeClasses.badgeDot,
              height: sizeClasses.badgeDot,
              backgroundColor: dotColor,
            }}
          />
        )}
        {/* text-box needs a block container — the badge root is a flex
            container, so the label gets its own span. Height is fixed (h-*),
            so trimming only recenters the letterforms. */}
        <span className="[text-box:trim-both_cap_alphabetic]">{children}</span>
      </span>
    );
  },
);

Badge.displayName = 'Badge';

export { Badge, badgeColors };
export type { BadgeColor };
