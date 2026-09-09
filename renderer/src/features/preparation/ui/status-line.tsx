import { Button } from '@/components/ui/button';
import {
  availableActions,
  readinessStatusLine,
  type PreparedFormat,
  type SourceReadiness,
} from '@/features/preparation/domain/readiness';
import type { PreparationAction } from '@/features/preparation/hooks/use-preparation-actions';
import { cn } from '@/lib/utils';

export interface PreparationStatusLineProps {
  error?: string | null;
  format: PreparedFormat;
  onCancel?: () => void;
  onReprocess?: () => void;
  pending?: PreparationAction | null;
  readiness: SourceReadiness;
}

/** One quiet row above a viewer: what preparation is doing and the one action
 *  that state offers. Renders nothing while the source is current. */
export function PreparationStatusLine({
  error = null,
  format,
  onCancel,
  onReprocess,
  pending = null,
  readiness,
}: PreparationStatusLineProps) {
  const line = readinessStatusLine(readiness, format);
  if (line === null) return null;
  const attention = readiness.kind === 'failed' || readiness.kind === 'blocked';
  const actions = availableActions(readiness);
  const busy = pending !== null;

  return (
    <div
      className="flex min-h-10 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3 py-1.5"
      data-preparation-status={readiness.kind}
    >
      <p
        className={cn(
          'min-w-0 flex-1 text-caption',
          attention ? 'text-destructive' : 'text-muted-foreground',
        )}
        role={attention ? 'alert' : 'status'}
      >
        {line}
        {error && (
          <>
            {' '}
            <span className="text-destructive">{error}</span>
          </>
        )}
      </p>
      {actions.reprocess && onReprocess && (
        <Button disabled={busy} onClick={onReprocess} size="compact" variant="tertiary">
          {pending === 'reprocess' ? 'Reprocessing…' : 'Reprocess'}
        </Button>
      )}
      {actions.cancel && onCancel && (
        <Button disabled={busy} onClick={onCancel} size="compact" variant="tertiary">
          {pending === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </Button>
      )}
    </div>
  );
}
