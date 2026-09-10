/**
 * The review window's session as one state machine.
 *
 * Main owns the draft; this window only ever holds the safe review model it
 * was handed. Every asynchronous command captures the session's generation
 * before its first await and carries it back on the event it dispatches, so a
 * completion from before a reopen lands on nothing. The reducer is total: an
 * event that does not belong to the current state is ignored rather than
 * guessed at, and nothing follows `closed`.
 */
import type { FeatureFailureKind } from '@/shared/domain/feature-error';

export type ArtifactKind = 'screenshot' | 'log' | 'diagnostics';

export interface ReviewDescription {
  readonly problem: string;
  readonly reproduction: string;
}

export interface DiagnosticsDetails {
  readonly appName: string;
  readonly appVersion: string;
  readonly architecture: string;
  readonly capturedAt: string;
  readonly electronVersion: string;
  readonly mode: 'Packaged' | 'Development';
  readonly platform: string;
  readonly platformRelease: string;
}

/** What the checklist row says about an artifact before it is previewed. */
type ArtifactSummary =
  | {
      readonly kind: 'screenshot';
      readonly byteLength: number;
      readonly height: number;
      readonly width: number;
    }
  | {
      readonly kind: 'log';
      readonly byteLength: number;
      readonly redactionCount: number;
      readonly truncated: boolean;
    }
  | { readonly kind: 'diagnostics' };

type ArtifactAvailability =
  | { readonly kind: 'available'; readonly included: boolean; readonly summary: ArtifactSummary }
  | { readonly kind: 'unavailable' };

export interface ReviewArtifact {
  readonly availability: ArtifactAvailability;
  readonly id: string;
  readonly kind: ArtifactKind;
}

export interface ReviewDraft {
  readonly artifacts: readonly ReviewArtifact[];
  readonly description: ReviewDescription;
}

/** The exact safe resource eligible for approval, as main hands it over. */
export type ArtifactPreview =
  | {
      readonly kind: 'screenshot';
      readonly byteLength: number;
      readonly dataUrl: string;
      readonly height: number;
      readonly width: number;
    }
  | {
      readonly kind: 'log';
      readonly byteLength: number;
      readonly redactionCount: number;
      readonly text: string;
      readonly truncated: boolean;
    }
  | { readonly kind: 'diagnostics'; readonly details: DiagnosticsDetails };

export interface ApprovedReport {
  readonly approvedAt: string;
  readonly artifacts: ReadonlyArray<{ readonly id: string; readonly kind: ArtifactKind }>;
  readonly description: ReviewDescription;
}

/** What main can refuse, beyond the transport kinds every feature shares. */
export type ReviewFailureExtra =
  | 'artifact-unavailable'
  | 'description-invalid'
  | 'downloads-failed'
  | 'draft-gone'
  | 'github-open-failed'
  | 'prepare-failed'
  | 'privacy'
  | 'wrong-state';

export type ReviewFailureKind = FeatureFailureKind<ReviewFailureExtra>;

export interface ReviewFailure {
  readonly kind: ReviewFailureKind;
}

export type PreviewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly preview: ArtifactPreview }
  | { readonly kind: 'failed'; readonly failure: ReviewFailure };

/** What the status line reports. Kinds only: the sentence is the view's. */
export type Notice =
  | { readonly kind: 'description-updated' }
  | {
      readonly kind: 'selection-updated';
      readonly artifact: ArtifactKind;
      readonly included: boolean;
    }
  | { readonly kind: 'handoff-complete'; readonly via: HandoffDestination }
  | { readonly kind: 'failed'; readonly failure: ReviewFailure };

type HandoffDestination = 'github' | 'download';

export type ReviewingPending =
  | null
  | { readonly kind: 'description' }
  | { readonly kind: 'selection'; readonly artifactId: string; readonly included: boolean };

export type ReadyPending = null | 'retry' | 'open-github' | 'download' | 'reopen';

/** `unprepared` is an approval this window did not see materialize (the draft
 *  was already approved when it loaded); `failed` is one it watched fail. Both
 *  offer the same idempotent retry. */
type Handoff =
  | { readonly kind: 'prepared' }
  | { readonly kind: 'unprepared' }
  | { readonly kind: 'failed'; readonly failure: ReviewFailure };

export interface ReviewingSession {
  readonly kind: 'reviewing';
  readonly generation: number;
  readonly draft: ReviewDraft;
  /** The description has edits main has not confirmed yet. */
  readonly dirty: boolean;
  readonly notice: Notice | null;
  readonly openPreviewId: string | null;
  readonly pending: ReviewingPending;
  readonly previews: Readonly<Record<string, PreviewState>>;
}

export interface PreparingSession {
  readonly kind: 'preparing';
  readonly generation: number;
  readonly draft: ReviewDraft;
  readonly openPreviewId: string | null;
  readonly previews: Readonly<Record<string, PreviewState>>;
}

export interface ReadySession {
  readonly kind: 'ready';
  readonly generation: number;
  readonly handoff: Handoff;
  readonly notice: Notice | null;
  readonly pending: ReadyPending;
  readonly report: ApprovedReport;
}

export type ReviewSession =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable'; readonly failure: ReviewFailure }
  | ReviewingSession
  | PreparingSession
  | ReadySession
  | { readonly kind: 'closed' };

interface Stamped {
  readonly generation: number;
}

export type ReviewEvent =
  | { readonly type: 'loaded'; readonly draft: ReviewDraft }
  | { readonly type: 'loaded-approved'; readonly report: ApprovedReport }
  | { readonly type: 'load-failed'; readonly failure: ReviewFailure }
  | (Stamped & { readonly type: 'description-edited'; readonly description: ReviewDescription })
  | (Stamped & { readonly type: 'description-commit-started' })
  | (Stamped & { readonly type: 'description-committed'; readonly draft: ReviewDraft })
  | (Stamped & {
      readonly type: 'selection-started';
      readonly artifactId: string;
      readonly included: boolean;
    })
  | (Stamped & {
      readonly type: 'selection-applied';
      readonly artifact: ArtifactKind;
      readonly draft: ReviewDraft;
      readonly included: boolean;
    })
  | (Stamped & { readonly type: 'preview-toggled'; readonly artifactId: string })
  | (Stamped & {
      readonly type: 'preview-loaded';
      readonly artifactId: string;
      readonly preview: ArtifactPreview;
    })
  | (Stamped & {
      readonly type: 'preview-failed';
      readonly artifactId: string;
      readonly failure: ReviewFailure;
    })
  | (Stamped & { readonly type: 'command-failed'; readonly failure: ReviewFailure })
  | (Stamped & { readonly type: 'prepare-started' })
  | (Stamped & { readonly type: 'prepared'; readonly report: ApprovedReport })
  | (Stamped & {
      readonly type: 'approved-unprepared';
      readonly failure: ReviewFailure;
      readonly report: ApprovedReport;
    })
  | (Stamped & { readonly type: 'prepare-failed'; readonly failure: ReviewFailure })
  | (Stamped & { readonly type: 'handoff-started'; readonly action: NonNullable<ReadyPending> })
  | (Stamped & { readonly type: 'handoff-completed'; readonly via: HandoffDestination })
  | (Stamped & { readonly type: 'retry-prepared' })
  | (Stamped & { readonly type: 'retry-failed'; readonly failure: ReviewFailure })
  | (Stamped & { readonly type: 'reopened'; readonly draft: ReviewDraft })
  | { readonly type: 'closed' };

export const initialReviewSession: ReviewSession = { kind: 'loading' };

function reviewing(generation: number, draft: ReviewDraft): ReviewingSession {
  return {
    dirty: false,
    draft,
    generation,
    kind: 'reviewing',
    notice: null,
    openPreviewId: null,
    pending: null,
    previews: {},
  };
}

function ready(generation: number, report: ApprovedReport, handoff: Handoff): ReadySession {
  return { generation, handoff, kind: 'ready', notice: null, pending: null, report };
}

function reduceReviewing(state: ReviewingSession, event: ReviewEvent): ReviewSession {
  switch (event.type) {
    case 'description-edited':
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, description: event.description },
      };
    // The commit carries the text as of now, so the field is clean from here:
    // an edit that lands during the round trip marks it dirty again and wins
    // over the older description main confirms.
    case 'description-commit-started':
      return { ...state, dirty: false, pending: { kind: 'description' } };
    case 'description-committed':
      return {
        ...state,
        draft: state.dirty ? { ...event.draft, description: state.draft.description } : event.draft,
        notice: { kind: 'description-updated' },
        pending: null,
      };
    case 'selection-started':
      return {
        ...state,
        pending: { artifactId: event.artifactId, included: event.included, kind: 'selection' },
      };
    case 'selection-applied':
      return {
        ...state,
        draft: event.draft,
        notice: { artifact: event.artifact, included: event.included, kind: 'selection-updated' },
        pending: null,
      };
    case 'preview-toggled': {
      if (state.openPreviewId === event.artifactId) return { ...state, openPreviewId: null };
      const previews =
        event.artifactId in state.previews
          ? state.previews
          : { ...state.previews, [event.artifactId]: { kind: 'loading' as const } };
      return { ...state, openPreviewId: event.artifactId, previews };
    }
    case 'preview-loaded':
      return {
        ...state,
        previews: {
          ...state.previews,
          [event.artifactId]: { kind: 'loaded', preview: event.preview },
        },
      };
    case 'preview-failed':
      return {
        ...state,
        previews: {
          ...state.previews,
          [event.artifactId]: { failure: event.failure, kind: 'failed' },
        },
      };
    case 'command-failed':
      return {
        ...state,
        dirty: state.dirty || state.pending?.kind === 'description',
        notice: { failure: event.failure, kind: 'failed' },
        pending: null,
      };
    case 'prepare-started':
      return {
        draft: state.draft,
        generation: state.generation,
        kind: 'preparing',
        openPreviewId: state.openPreviewId,
        previews: state.previews,
      };
    default:
      return state;
  }
}

function reducePreparing(state: PreparingSession, event: ReviewEvent): ReviewSession {
  switch (event.type) {
    case 'prepared':
      return ready(state.generation, event.report, { kind: 'prepared' });
    case 'approved-unprepared':
      return ready(state.generation, event.report, { failure: event.failure, kind: 'failed' });
    case 'prepare-failed':
      return {
        ...reviewing(state.generation, state.draft),
        notice: { failure: event.failure, kind: 'failed' },
        openPreviewId: state.openPreviewId,
        previews: state.previews,
      };
    default:
      return state;
  }
}

function reduceReady(state: ReadySession, event: ReviewEvent): ReviewSession {
  switch (event.type) {
    case 'handoff-started':
      return { ...state, notice: null, pending: event.action };
    case 'handoff-completed':
      return { ...state, notice: { kind: 'handoff-complete', via: event.via }, pending: null };
    case 'retry-prepared':
      return { ...state, handoff: { kind: 'prepared' }, pending: null };
    case 'retry-failed':
      return { ...state, handoff: { failure: event.failure, kind: 'failed' }, pending: null };
    case 'command-failed':
      return { ...state, notice: { failure: event.failure, kind: 'failed' }, pending: null };
    case 'reopened':
      return reviewing(state.generation + 1, event.draft);
    default:
      return state;
  }
}

export function reduceReviewSession(state: ReviewSession, event: ReviewEvent): ReviewSession {
  if (state.kind === 'closed') return state;
  if (event.type === 'closed') return { kind: 'closed' };
  if (
    'generation' in event &&
    ('generation' in state ? state.generation : null) !== event.generation
  ) {
    return state;
  }
  switch (state.kind) {
    case 'loading':
      if (event.type === 'loaded') return reviewing(1, event.draft);
      if (event.type === 'loaded-approved') return ready(1, event.report, { kind: 'unprepared' });
      if (event.type === 'load-failed') return { failure: event.failure, kind: 'unavailable' };
      return state;
    case 'unavailable':
      return state;
    case 'reviewing':
      return reduceReviewing(state, event);
    case 'preparing':
      return reducePreparing(state, event);
    case 'ready':
      return reduceReady(state, event);
  }
}

/** The generation a command must stamp its events with, or null when the
 *  session accepts no stamped events at all. */
export function sessionGeneration(state: ReviewSession): number | null {
  return 'generation' in state ? state.generation : null;
}
