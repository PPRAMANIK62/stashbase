import { Progress as ProgressPrimitive } from '@base-ui/react/progress';

import { cn } from '@/common/lib/utils';

/**
 * Determinate progress, in shadcn's part names.
 *
 * The point of the primitive is the part that is not visible: Root carries
 * `role="progressbar"` with `aria-valuenow`/`min`/`max`, so the bar reports
 * a number instead of being a coloured rectangle only sighted users can
 * read. The app's download bar was a `<span>` inside a `<span>` with an
 * inline width — visually complete, semantically silent.
 */
function Progress({ className, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('flex items-center gap-2', className)}
      {...props}
    />
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      className={cn(
        // A capsule on purpose — a progress track is one of the shapes the
        // corner language reserves the capsule for.
        'relative block h-1.5 w-26 overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    />
  );
}

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        'block h-full rounded-full bg-primary transition-[inline-size] duration-standard ease-out',
        className,
      )}
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      data-slot="progress-value"
      className={cn('text-sm text-muted-foreground tabular-nums', className)}
      {...props}
    />
  );
}

export { Progress, ProgressIndicator, ProgressTrack, ProgressValue };
