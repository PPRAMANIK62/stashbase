import type {
  FolderIndexStatus,
  PreparationFailure,
  PreparationProgress,
} from '@/shared/domain/folder-index-status';

export type SourceReadiness =
  | { readonly kind: 'current' }
  | { readonly kind: 'pending'; readonly progress: PreparationProgress | null }
  | { readonly kind: 'blocked' }
  | { readonly kind: 'failed'; readonly attempts: number; readonly error: string }
  | { readonly kind: 'cancelled' };

export type PreparedFormat = 'pdf' | 'image' | 'docx' | 'media';

export interface FolderPreparationSummary {
  readonly blocked: number;
  readonly cancelled: number;
  readonly failed: number;
  /** A failure, a blocked source, or an index warning needs the user. */
  readonly needsAttention: boolean;
  readonly pending: number;
}

const CURRENT: SourceReadiness = { kind: 'current' };
const BLOCKED: SourceReadiness = { kind: 'blocked' };
const CANCELLED: SourceReadiness = { kind: 'cancelled' };

const POLL_BUSY_MS = 1_500;
const POLL_IDLE_MS = 8_000;

/** A legacy derived note `dir/.base.ext.md` names its visible source
 *  `dir/base.ext`; every other spelling is already the source path. */
export function sourcePathForRecord(recordPath: string): string {
  const separator = recordPath.lastIndexOf('/');
  const directory = separator === -1 ? '' : recordPath.slice(0, separator + 1);
  const name = separator === -1 ? recordPath : recordPath.slice(separator + 1);
  const derived = /^\.(.+)\.md$/u.exec(name);
  return derived ? `${directory}${derived[1]}` : recordPath;
}

export function preparationFailureFor(
  status: FolderIndexStatus,
  sourcePath: string,
): PreparationFailure | null {
  return (
    status.preparationFailures.find(
      (failure) => failure.path === sourcePath || sourcePathForRecord(failure.path) === sourcePath,
    ) ?? null
  );
}

export function sourceReadiness(
  status: FolderIndexStatus | null | undefined,
  sourcePath: string,
): SourceReadiness {
  if (!status) return CURRENT;
  const failure = preparationFailureFor(status, sourcePath);
  if (failure) {
    return failure.status === 'cancelled'
      ? CANCELLED
      : { attempts: failure.attempts, error: failure.lastError, kind: 'failed' };
  }
  if (status.blockedConversions.includes(sourcePath)) return BLOCKED;
  const progress = status.conversionProgress[sourcePath];
  if (progress) return { kind: 'pending', progress };
  if (status.pendingConversions.includes(sourcePath)) return { kind: 'pending', progress: null };
  return CURRENT;
}

export function folderPreparationSummary(
  status: FolderIndexStatus | null | undefined,
): FolderPreparationSummary {
  if (!status) return { blocked: 0, cancelled: 0, failed: 0, needsAttention: false, pending: 0 };
  let failed = 0;
  let cancelled = 0;
  for (const failure of status.preparationFailures) {
    if (failure.status === 'cancelled') cancelled += 1;
    else failed += 1;
  }
  const blocked = status.blockedConversions.length;
  return {
    blocked,
    cancelled,
    failed,
    needsAttention: failed > 0 || blocked > 0 || status.semantic.warning !== null,
    pending: status.pendingConversions.length,
  };
}

/** Poll quickly while preparation or embedding work is moving, slowly when idle. */
export function preparationPollInterval(status: FolderIndexStatus | null | undefined): number {
  if (!status) return POLL_BUSY_MS;
  const busy =
    status.pendingConversions.length > 0 ||
    status.blockedConversions.length > 0 ||
    !status.semantic.settled;
  return busy ? POLL_BUSY_MS : POLL_IDLE_MS;
}

function progressCopy(progress: PreparationProgress | null, format: PreparedFormat): string {
  if (!progress) return 'Waiting to prepare searchable text…';
  switch (progress.phase) {
    case 'queued':
    case 'yielded':
      return progress.tasksAhead > 0
        ? 'Waiting for other file preparation to finish…'
        : 'Waiting to prepare searchable text…';
    case 'indexing':
      return format === 'media' ? 'Indexing transcript…' : 'Indexing searchable text…';
    case 'extracting':
      if (format === 'pdf' && progress.currentPage !== undefined) {
        return `Reading page ${progress.currentPage}…`;
      }
      if (format === 'image') return 'Reading image text…';
      if (
        format === 'media' &&
        progress.completedUnits !== undefined &&
        progress.totalUnits !== undefined
      ) {
        return `Transcribing ${progress.completedUnits} of ${progress.totalUnits} segments…`;
      }
      return format === 'media' ? 'Transcribing…' : 'Preparing searchable text…';
  }
}

/** One line for a viewer status row; null when nothing needs saying. */
export function readinessStatusLine(
  readiness: SourceReadiness,
  format: PreparedFormat,
): string | null {
  switch (readiness.kind) {
    case 'current':
      return null;
    case 'pending':
      return progressCopy(readiness.progress, format);
    case 'blocked':
      return 'Transcription setup is required before this file becomes searchable.';
    case 'cancelled':
      return format === 'media'
        ? 'Transcription was cancelled. Reprocess when you are ready.'
        : 'Preparation was cancelled. Reprocess it when you want searchable text.';
    case 'failed':
      switch (format) {
        case 'pdf':
          return 'This PDF is not searchable. Reprocess it to try again.';
        case 'image':
          return 'Searchable text is unavailable. The image still opens normally.';
        case 'docx':
          return 'The document is visible, but its searchable text is unavailable.';
        case 'media':
          return readiness.error
            ? `Transcription failed: ${readiness.error}`
            : 'Transcription failed. Reprocess it to try again.';
      }
  }
}

export interface TreeMarker {
  readonly kind: 'blocked' | 'cancelled' | 'failed';
  readonly title: string;
}

/** Tree rows mark only states that need the user; pending stays quiet. */
export function treeMarker(readiness: SourceReadiness): TreeMarker | null {
  switch (readiness.kind) {
    case 'failed':
      return { kind: 'failed', title: 'File preparation failed; this file may not be searchable.' };
    case 'cancelled':
      return {
        kind: 'cancelled',
        title: 'File preparation was cancelled. Reprocess it when you want searchable text.',
      };
    case 'blocked':
      return {
        kind: 'blocked',
        title: 'Transcription setup is required to make this file searchable.',
      };
    default:
      return null;
  }
}

/** Which actions a source's state offers; the server stays the authority. */
export function availableActions(readiness: SourceReadiness): {
  readonly cancel: boolean;
  readonly reprocess: boolean;
} {
  return {
    cancel: readiness.kind === 'pending',
    reprocess: readiness.kind === 'failed' || readiness.kind === 'cancelled',
  };
}
