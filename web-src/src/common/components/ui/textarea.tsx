import * as React from 'react';

import { cn } from '@/common/lib/utils';

/**
 * Multi-line text field. Shares the Input primitive's box treatment —
 * container corner, input border, and the same no-focus-ring rule: the
 * caret is the focus affordance — so a form does not read as two
 * different families of control stacked on each other.
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-16 w-full min-w-0 resize-y rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none',
        'transition-tint',
        'placeholder:text-placeholder',
        'disabled:pointer-events-none disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
