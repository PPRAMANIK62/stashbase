import * as React from 'react';

import { Label } from '@/common/components/ui/label';
import { cn } from '@/common/lib/utils';

/**
 * Form structure, in shadcn's part names.
 *
 * `FieldSet` + `FieldLegend` is the HTML answer to a group of related
 * controls — a set of radios, a segmented choice — and the legend is both
 * the visible label and the group's accessible name, so the control inside
 * never repeats the string as an `aria-label` that can drift out of step
 * with the text beside it.
 *
 * `Field` + `FieldLabel` is the single-control case. Pass the same `id` to
 * the label's `htmlFor` and the control.
 */
function FieldSet({ className, ...props }: React.ComponentProps<'fieldset'>) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn('m-0 flex min-w-0 flex-col border-0 p-0', className)}
      {...props}
    />
  );
}

function FieldLegend({ className, ...props }: React.ComponentProps<'legend'>) {
  return (
    <legend
      data-slot="field-legend"
      className={cn('mb-1.5 p-0 text-base leading-snug font-semibold text-foreground', className)}
      {...props}
    />
  );
}

/** A stack of fields that share one rhythm. */
function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="field-group" className={cn('flex flex-col gap-4', className)} {...props} />
  );
}

function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="field" className={cn('flex flex-col gap-1.5', className)} {...props} />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<'label'>) {
  return <Label data-slot="field-label" className={className} {...props} />;
}

/** The subdued explanatory line under a label or legend. */
function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn('m-0 text-sm leading-normal text-muted-foreground', className)}
      {...props}
    />
  );
}

function FieldError({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn('m-0 text-sm leading-normal text-destructive', className)}
      {...props}
    />
  );
}

export {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
};
