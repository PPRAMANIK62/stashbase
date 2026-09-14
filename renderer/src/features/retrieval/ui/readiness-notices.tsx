import { Button } from '@/components/ui/button';
import type {
  PreparationReadinessLine,
  SemanticIndexNotice,
  SemanticReadinessAction,
} from '@/features/retrieval/domain/semantic-readiness';
import type { IndexDecisionAction } from '@/features/retrieval/hooks/use-index-decisions';
import { cn } from '@/lib/utils';

const ACTION_LABELS: Record<SemanticReadinessAction, string> = {
  'dismiss-warning': 'Dismiss',
  'retry-index': 'Retry',
};

const PENDING_LABELS: Record<IndexDecisionAction, string> = {
  'dismiss-warning': 'Dismissing…',
  'retry-index': 'Retrying…',
};

const PRIMARY_ACTIONS = new Set<SemanticReadinessAction>(['retry-index']);

export interface SemanticReadinessNoticeProps {
  error: string | null;
  notice: SemanticIndexNotice;
  onDecision(action: IndexDecisionAction): void;
  pendingAction: IndexDecisionAction | null;
}

/** What search by meaning needs from the reader. The notice already decided it
 *  has something to say, so this view only renders it. */
export function SemanticReadinessNotice({
  error,
  notice,
  onDecision,
  pendingAction,
}: SemanticReadinessNoticeProps) {
  const attention = notice.tone === 'attention';
  return (
    <div
      className={cn(
        'mx-2 mb-2 rounded-md border px-3 py-2',
        notice.prominent ? 'border-border bg-surface-2' : 'border-transparent',
      )}
      role={attention ? 'alert' : 'status'}
    >
      <p
        className={cn(
          'text-caption font-medium',
          attention ? 'text-destructive' : 'text-foreground',
        )}
      >
        {notice.title}
      </p>
      {notice.detail && (
        <p className="text-caption leading-relaxed text-muted-foreground">{notice.detail}</p>
      )}
      {error && (
        <p className="pt-1 text-caption text-destructive" role="alert">
          {error}
        </p>
      )}
      {notice.actions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1.5">
          {notice.actions.map((action) => {
            const pending =
              pendingAction !== null && pendingAction === action
                ? PENDING_LABELS[pendingAction]
                : null;
            return (
              <Button
                disabled={pendingAction !== null}
                key={action}
                onClick={() => onDecision(action)}
                size="compact"
                variant={PRIMARY_ACTIONS.has(action) ? 'secondary' : 'tertiary'}
              >
                {pending ?? ACTION_LABELS[action]}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface PreparationReadinessNoticeProps {
  line: PreparationReadinessLine;
  onOpenSettings(): void;
}

export function PreparationReadinessNotice({
  line,
  onOpenSettings,
}: PreparationReadinessNoticeProps) {
  return (
    <div className="mx-2 mb-2 px-3 py-1" role="status">
      <p className="text-caption font-medium text-foreground">{line.title}</p>
      <p className="text-caption leading-relaxed text-muted-foreground">{line.detail}</p>
      {line.action === 'open-settings' && (
        <Button className="mt-1" onClick={onOpenSettings} size="compact" variant="tertiary">
          Open Settings
        </Button>
      )}
    </div>
  );
}
