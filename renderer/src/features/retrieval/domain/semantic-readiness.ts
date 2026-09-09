import type { SemanticIndexStatus } from '@/shared/domain/folder-index-status';

export type SemanticReadinessAction =
  | 'build'
  | 'dismiss-warning'
  | 'not-now'
  | 'open-settings'
  | 'resume'
  | 'retry-index';

export type SemanticReadinessState =
  | 'awaiting-decision'
  | 'failed'
  | 'indexing'
  | 'not-set-up'
  | 'paused'
  | 'quota-exhausted'
  | 'ready'
  | 'unknown';

export interface SemanticReadiness {
  readonly actions: readonly SemanticReadinessAction[];
  /** Whether a Similar search may run now. Exact search never depends on it. */
  readonly canSearch: boolean;
  readonly detail: string | null;
  /** True when the reader should see the notice even without a query. */
  readonly prominent: boolean;
  readonly state: SemanticReadinessState;
  readonly title: string | null;
}

const EXACT_STILL_WORKS = 'Exact text search works without AI Index.';

function mebibytes(bytes: number): string {
  const value = bytes / (1024 * 1024);
  return value >= 10 ? Math.round(value).toString() : value.toFixed(1);
}

function workloadDetail(status: SemanticIndexStatus): string {
  const files = status.sourceCount ?? status.pending.length;
  const size =
    status.estimatedBytes === null ? '' : ` · about ${mebibytes(status.estimatedBytes)} MiB`;
  return `About ${files} ${files === 1 ? 'file' : 'files'} waiting${size}. Building AI Index may take a while and use provider quota. Exact text search remains available.`;
}

export function semanticReadiness(
  status: SemanticIndexStatus | null | undefined,
): SemanticReadiness {
  if (!status) {
    return {
      actions: [],
      canSearch: false,
      detail: null,
      prominent: false,
      state: 'unknown',
      title: null,
    };
  }
  if (!status.enabled || status.state === 'disabled') {
    return {
      actions: ['open-settings'],
      canSearch: false,
      detail: EXACT_STILL_WORKS,
      prominent: false,
      state: 'not-set-up',
      title: 'Set up AI Index to search by meaning.',
    };
  }
  if (status.state === 'quota-exhausted' || status.state === 'partial-quota-exhausted') {
    return {
      actions: ['open-settings'],
      canSearch: false,
      detail: 'Exact search is still available.',
      prominent: false,
      state: 'quota-exhausted',
      title: 'Your hosted AI Index allowance is exhausted.',
    };
  }
  if (status.state === 'awaiting-decision') {
    return {
      actions: ['build', 'not-now'],
      canSearch: true,
      detail: workloadDetail(status),
      prominent: true,
      state: 'awaiting-decision',
      title: 'Large AI Index workload',
    };
  }
  if (status.state === 'paused' || status.state === 'partial-paused') {
    return {
      actions: ['resume', 'not-now'],
      canSearch: status.state === 'partial-paused',
      detail: workloadDetail(status),
      prominent: true,
      state: 'paused',
      title: 'AI Index paused',
    };
  }
  if (status.state === 'failed' && status.warning) {
    return {
      actions: ['retry-index', 'dismiss-warning'],
      canSearch: true,
      detail: `Search may be incomplete: ${status.warning.message}`,
      prominent: false,
      state: 'failed',
      title: 'Search needs attention',
    };
  }
  if (status.state === 'indexing' || status.state === 'partial-indexing') {
    const remaining = status.pending.length;
    return {
      actions: [],
      canSearch: status.state === 'partial-indexing',
      detail:
        remaining > 0 ? `${remaining} ${remaining === 1 ? 'file' : 'files'} remaining.` : null,
      prominent: false,
      state: 'indexing',
      title: 'Building AI Index…',
    };
  }
  return {
    actions: [],
    canSearch: true,
    detail: null,
    prominent: false,
    state: 'ready',
    title: null,
  };
}

export interface PreparationCounts {
  readonly blocked: number;
  readonly cancelled: number;
  readonly failed: number;
  readonly pending: number;
}

export interface PreparationReadinessLine {
  readonly action: 'open-settings' | null;
  readonly detail: string;
  readonly title: string;
  readonly tone: 'attention' | 'progress';
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** The Task 43 search line: only preparation, never AI Index. */
export function preparationReadinessLine(
  counts: PreparationCounts,
  readyCount: number,
): PreparationReadinessLine | null {
  if (counts.failed > 0 || counts.cancelled > 0) {
    const parts = [
      counts.failed > 0 ? `${counts.failed} failed` : null,
      counts.cancelled > 0 ? `${counts.cancelled} cancelled` : null,
    ].filter((part): part is string => part !== null);
    return {
      action: null,
      detail: `${parts.join(' · ')}. Open a file to retry it.`,
      title:
        counts.failed > 0
          ? 'Some files could not be prepared for search.'
          : 'Some file preparation was cancelled.',
      tone: 'attention',
    };
  }
  if (counts.blocked > 0) {
    return {
      action: 'open-settings',
      detail: `${plural(readyCount, 'file')} ready to search. ${plural(counts.blocked, 'media file')} need transcription setup.`,
      title: 'Transcription setup required',
      tone: 'attention',
    };
  }
  if (counts.pending > 0) {
    return {
      action: null,
      detail: `${plural(readyCount, 'file')} ready to search. ${counts.pending} still being prepared.`,
      title: 'Preparing text for search',
      tone: 'progress',
    };
  }
  return null;
}
