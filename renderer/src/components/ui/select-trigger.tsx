/** SelectTrigger — the button that names the current value and opens the
 *  popup. It reads the size ladder, the focus ring, the leading icon slot
 *  and the chevron; the value text itself comes from Base UI, resolved from
 *  the option list `Select` hands the primitive. */
'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';

import { FOCUS_RING } from '@/lib/focus-ring';
import type { IconComponent } from '@/lib/icon-context';
import { useShape } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import { cn } from '@/lib/utils';

const triggerVariants = cva(
  [
    'group inline-flex cursor-pointer items-center justify-between outline-none',
    'transition-all duration-fast',
    'disabled:pointer-events-none disabled:opacity-50',
    FOCUS_RING,
  ],
  {
    variants: {
      variant: {
        bordered: 'border border-border bg-transparent text-foreground hover:bg-hover',
        borderless: 'border border-transparent bg-transparent text-foreground hover:bg-hover',
      },
    },
    defaultVariants: {
      variant: 'bordered',
    },
  },
);

interface SelectTriggerProps
  extends
    Omit<HTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof triggerVariants> {
  icon?: IconComponent;
  placeholder?: string;
  error?: string;
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  (
    {
      className,
      variant,
      icon: Icon,
      placeholder = 'Select…',
      error,
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...props
    },
    ref,
  ) => {
    const shape = useShape();
    // The step comes from the Select around it (or the surrounding
    // SizeProvider), never from the trigger alone: a trigger sized apart from
    // its own popup is a control whose menu rows do not line up with it, and
    // there is no reading of the design where that is what the caller meant.
    const sizeClasses = useSize();
    const compact = sizeClasses.variant === 'compact';

    // A combobox is not named by its own contents: the text inside the trigger
    // is the current *value*, so a trigger with no label is an unnamed
    // control. The caller names it — with `aria-label`, `aria-labelledby`, or
    // an `id` for a `<label for>` to point at — and when it does none of
    // those, the placeholder stands in. The placeholder is the one string this
    // primitive holds that describes the choice rather than the answer to it;
    // naming the button after the selected option instead would make a screen
    // reader read that option twice and never say what it is for.
    const namedByCaller =
      ariaLabel !== undefined || ariaLabelledBy !== undefined || id !== undefined;

    return (
      <div className="flex flex-col gap-1">
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          aria-invalid={!!error || undefined}
          aria-label={namedByCaller ? ariaLabel : placeholder}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            triggerVariants({ variant }),
            sizeClasses.control,
            sizeClasses.text,
            sizeClasses.px,
            sizeClasses.gap,
            compact ? 'min-w-[128px]' : 'min-w-[160px]',
            shape.input,
            error && 'border-destructive/50 hover:border-destructive/50',
            className,
          )}
          {...props}
        >
          <span className={cn('flex min-w-0 flex-1 items-center', sizeClasses.gap)}>
            {Icon && (
              <Icon
                size={sizeClasses.icon}
                strokeWidth={1.5}
                className="shrink-0 text-muted-foreground transition-[color,stroke-width] duration-fast group-hover:stroke-[2] group-hover:text-foreground"
              />
            )}
            <SelectPrimitive.Value
              placeholder={placeholder}
              // py-1/-my-1: truncate's overflow:hidden clips at the padding
              // box, and the trimmed box excludes ascenders/descenders — the
              // padding gives glyphs room while the negative margin keeps the
              // trimmed layout box.
              // The value text itself is Base UI's: it resolves the current
              // value against the option list `Select` passes the root, which
              // is why that list has to exist before the popup ever mounts.
              className="-my-1 min-w-0 flex-1 truncate py-1 text-left [text-box:trim-both_cap_alphabetic] data-[placeholder]:text-muted-foreground"
            />
          </span>

          <svg
            width={sizeClasses.icon}
            height={sizeClasses.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground transition-colors duration-fast group-hover:text-foreground"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </SelectPrimitive.Trigger>
        {error && <span className={cn('pl-3 text-destructive', sizeClasses.caption)}>{error}</span>}
      </div>
    );
  },
);

SelectTrigger.displayName = 'SelectTrigger';

export { SelectTrigger };
