import { cn } from '@/lib/utils';
import type { FailureView } from '@/shared/domain/feature-error';

/**
 * One failure, said the way its kind deserves.
 *
 * A refusal of what the reader typed or asked for is an alert in the
 * destructive tone: there is something on this screen to correct. A
 * capability StashBase cannot reach right now is a quiet status instead —
 * shouting at someone about a server they cannot fix only adds noise.
 */
export function FailureNotice({
  className,
  failure: { message, tone },
}: {
  className?: string;
  failure: FailureView;
}) {
  return tone === 'input' ? (
    <p className={cn('text-caption text-destructive', className)} role="alert">
      {message}
    </p>
  ) : (
    <p className={cn('text-caption text-muted-foreground', className)} role="status">
      {message}
    </p>
  );
}
