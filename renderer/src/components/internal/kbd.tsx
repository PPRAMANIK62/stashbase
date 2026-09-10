'use client';

import { forwardRef, type HTMLAttributes } from 'react';

import { useSize, type SizeVariant } from '@/lib/size-context';
import { cn } from '@/lib/utils';

type KbdVariant = 'outline' | 'filled' | 'inverted';

const variants: Record<KbdVariant, string> = {
  /** On a normal surface: a hairline keycap that reads as a physical key. */
  outline: 'border border-border bg-background text-muted-foreground',
  /** On a normal surface, as a passive hint (a shortcut echoed in a field):
   *  a tint instead of an outline, so it recedes. */
  filled: 'bg-foreground/10 text-muted-foreground',
  /** On an inverted surface — inside a tooltip, which paints itself with the
   *  foreground colour — where border and text invert with it. */
  inverted: 'border border-background/30 text-background/80',
};

interface KbdProps extends HTMLAttributes<HTMLElement> {
  variant?: KbdVariant;
  /** Omitted, the keycap follows the surrounding SizeProvider. */
  size?: SizeVariant;
}

/**
 * A keystroke chip: `⌘K`, `Tab`, `[`.
 *
 * `<kbd>` renders monospace by default, which at 10-11px reads as code rather
 * than as a key, so the face is explicitly `font-sans`. The radius is a flat
 * 4px rather than the shape ladder's: a chip this short takes the ladder's
 * 8px as a pill.
 */
const Kbd = forwardRef<HTMLElement, KbdProps>(
  ({ className, size, variant = 'outline', ...props }, ref) => {
    // The keycap step is the ladder's, not this component's — see size-context.
    const { keycap } = useSize(size);
    return (
      <kbd
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded font-sans leading-none',
          keycap,
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Kbd.displayName = 'Kbd';

export { Kbd };
