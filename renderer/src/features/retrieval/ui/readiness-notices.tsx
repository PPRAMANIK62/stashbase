import { Button } from '@/components/ui/button';
import type {
  PreparationReadinessLine,
  SemanticReadiness,
  SemanticReadinessAction,
} from '@/features/retrieval/domain/semantic-readiness';
import type { IndexDecisionAction } from '@/features/retrieval/hooks/use-index-decisions';
import { cn } from '@/lib/utils';

const ACTION_LABELS: Record<SemanticReadinessAction, string> = {
  build: 'Build AI Index',
  'dismiss-warning': 'Dismiss',
  'not-now': 'Not now',
  'open-settings': 'Open Settings',
  resume: 'Resume AI Index',
  'retry-index': 'Retry',
};

const PENDING_LABELS: Record<IndexDecisionAction, string> = {
  build: 'Starting…',
  'dismiss-warning': 'Dismissing…',
  'not-now': 'Deferring…',
  resume: 'Resuming…',
  'retry-index': 'Retrying…',
};

export interface SemanticReadinessNoticeProps {
  error: string | null;
  onDecision(action: IndexDecisionAction): void;
  onOpenSettings(): void;
  pendingAction: IndexDecisionAction | null;
  readiness: SemanticReadiness;
}

export function SemanticReadinessNotice({
  error,
  onDecision,
  onOpenSettings,
  pendingAction,
  readiness,
}: SemanticReadinessNoticeProps) {
  if (!readiness.title && !readiness.detail) return null;
  const attention = readiness.state === 'failed' || readiness.state === 'quota-exhausted';
  return (
    <div
      className={cn(
        'mx-2 mb-2 rounded-md border px-3 py-2',
        readiness.prominent ? 'border-border bg-surface-2' : 'border-transparent',
      )}
      role={attention ? 'alert' : 'status'}
    >
      {readiness.title && (
        <p
          className={cn(
            'text-caption font-medium',
            attention ? 'text-destructive' : 'text-foreground',
          )}
        >
          {readiness.title}
        </p>
      )}
      {readiness.detail && (
        <p className="text-caption leading-relaxed text-muted-foreground">{readiness.detail}</p>
      )}
      {error && (
        <p className="pt-1 text-caption text-destructive" role="alert">
          {error}
        </p>
      )}
      {readiness.actions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1.5">
          {readiness.actions.map((action) => {
            const primary = action === 'build' || action === 'resume' || action === 'retry-index';
            const pending = pendingAction === action;
            return (
              <Button
                disabled={pendingAction !== null}
                key={action}
                onClick={() => (action === 'open-settings' ? onOpenSettings() : onDecision(action))}
                size="compact"
                variant={primary ? 'secondary' : 'tertiary'}
              >
                {pending ? PENDING_LABELS[action as IndexDecisionAction] : ACTION_LABELS[action]}
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
