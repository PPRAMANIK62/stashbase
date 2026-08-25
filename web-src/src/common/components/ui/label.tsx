import * as React from 'react';

import { cn } from '@/common/lib/utils';

/**
 * A control's visible name, associated through `htmlFor`.
 *
 * This is the piece an `aria-label` cannot replace: it names the control
 * for assistive tech AND makes the visible text a click target that focuses
 * the field. The app had 100 `aria-label`s against 14 real labels.
 */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-1.5 text-base leading-snug font-semibold text-foreground select-none',
        'peer-disabled:pointer-events-none peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
