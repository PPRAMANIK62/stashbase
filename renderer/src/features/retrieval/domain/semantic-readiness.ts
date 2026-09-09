/**
 * AI Index readiness for the search surface.
 *
 * The states arrive already reduced: the shell hands search one variant per
 * observable state, each carrying exactly the facts its notice needs.
 * `canSemanticSearch` and `semanticIndexNotice` derive the two answers a
 * surface asks for, so no caller reads a loose flag beside the state it came
 * from, and nothing here reaches for the daemon's own status shape.
 */

export type SemanticReadinessAction =
  | 'build'
  | 'dismiss-warning'
  | 'not-now'
  | 'open-settings'
  | 'resume'
  | 'retry-index';

/** What an unresolved AI Index build would cost the reader deciding on it. */
interface SemanticWorkload {
  readonly estimatedBytes: number | null;
  readonly files: number;
}

export type SemanticReadiness =
  | { readonly state: 'awaiting-decision'; readonly workload: SemanticWorkload }
  | { readonly state: 'failed'; readonly warning: string }
  /** `partial` marks an index that already answers while the rest builds. */
  | { readonly partial: boolean; readonly remaining: number; readonly state: 'indexing' }
  | { readonly partial: boolean; readonly state: 'paused'; readonly workload: SemanticWorkload }
  | { readonly state: 'not-set-up' }
  | { readonly state: 'quota-exhausted' }
  | { readonly state: 'ready' }
  | { readonly state: 'unknown' };

const EXACT_STILL_WORKS = 'Exact text search works without AI Index.';

function mebibytes(bytes: number): string {
  const value = bytes / (1024 * 1024);
  return value >= 10 ? Math.round(value).toString() : value.toFixed(1);
}

function workloadDetail(workload: SemanticWorkload): string {
  const files = workload.files;
  const size =
    workload.estimatedBytes === null ? '' : ` · about ${mebibytes(workload.estimatedBytes)} MiB`;
  return `About ${files} ${files === 1 ? 'file' : 'files'} waiting${size}. Building AI Index may take a while and use provider quota. Exact text search remains available.`;
}

/** Whether a Similar search may run now. Exact search never depends on it. */
export function canSemanticSearch(readiness: SemanticReadiness): boolean {
  switch (readiness.state) {
    case 'awaiting-decision':
    case 'failed':
    case 'ready':
      return true;
    case 'indexing':
    case 'paused':
      return readiness.partial;
    case 'not-set-up':
    case 'quota-exhausted':
    case 'unknown':
      return false;
  }
}

export interface SemanticIndexNotice {
  readonly actions: readonly SemanticReadinessAction[];
  readonly detail: string | null;
  /** Shown whichever search backend is selected, because it explains an
   *  index the reader has not resolved yet. */
  readonly persistent: boolean;
  /** Drawn in its own box rather than as a quiet line. */
  readonly prominent: boolean;
  readonly title: string;
  readonly tone: 'attention' | 'neutral';
}

/** What the reader should be told about the AI Index, or null when the state
 *  has nothing to say. */
export function semanticIndexNotice(readiness: SemanticReadiness): SemanticIndexNotice | null {
  switch (readiness.state) {
    case 'awaiting-decision':
      return {
        actions: ['build', 'not-now'],
        detail: workloadDetail(readiness.workload),
        persistent: true,
        prominent: true,
        title: 'Large AI Index workload',
        tone: 'neutral',
      };
    case 'failed':
      return {
        actions: ['retry-index', 'dismiss-warning'],
        detail: `Search may be incomplete: ${readiness.warning}`,
        persistent: true,
        prominent: false,
        title: 'Search needs attention',
        tone: 'attention',
      };
    case 'indexing':
      return {
        actions: [],
        detail:
          readiness.remaining > 0
            ? `${readiness.remaining} ${readiness.remaining === 1 ? 'file' : 'files'} remaining.`
            : null,
        persistent: false,
        prominent: false,
        title: 'Building AI Index…',
        tone: 'neutral',
      };
    case 'not-set-up':
      return {
        actions: ['open-settings'],
        detail: EXACT_STILL_WORKS,
        persistent: false,
        prominent: false,
        title: 'Set up AI Index to search by meaning.',
        tone: 'neutral',
      };
    case 'paused':
      return {
        actions: ['resume', 'not-now'],
        detail: workloadDetail(readiness.workload),
        persistent: true,
        prominent: true,
        title: 'AI Index paused',
        tone: 'neutral',
      };
    case 'quota-exhausted':
      return {
        actions: ['open-settings'],
        detail: 'Exact search is still available.',
        persistent: false,
        prominent: false,
        title: 'Your hosted AI Index allowance is exhausted.',
        tone: 'attention',
      };
    case 'ready':
    case 'unknown':
      return null;
  }
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
