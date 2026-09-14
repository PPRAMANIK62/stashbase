import { focusRing } from '@/lib/focus-ring';
import { cn } from '@/lib/utils';

/**
 * The chrome a multi-line text field wears, wherever one appears.
 *
 * What is fixed here is what a field is: a bordered box the reader types into,
 * with placeholder text that recedes, a disabled state that dims, and a focus
 * indicator. The focus ring is the reason this is shared rather than copied —
 * a field that turns its outline off and forgets to put a ring back leaves a
 * keyboard reader with no way to see where they are, and that is exactly what
 * happened while two dialogs each spelled their own field out.
 *
 * What is not fixed is what belongs to the surface the field sits on: its
 * background, its corner, its type, its height, and whether it can be dragged
 * taller. A field inside a raised dialog and a field on a plain form are not
 * the same colour, and pretending otherwise would make one of them invisible.
 */
export function textFieldClass(...surface: (string | false | null | undefined)[]): string {
  return focusRing(
    cn(
      'block w-full border border-border px-3 py-2 outline-none placeholder:text-muted-foreground disabled:opacity-50',
      ...surface,
    ),
  );
}
