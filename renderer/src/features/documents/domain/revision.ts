/**
 * One document's inline revision review: a whole-document proposal offered
 * against a known source version, accepted or rejected change by change
 * inside the readable document.
 *
 * The review is a state of the document, so it sits on `DocumentState`
 * beside the view mode rather than in a store of its own, and it is a union
 * rather than a flag beside a proposal string: the count of changes still
 * pending cannot exist before the editor has reported one, so only the
 * variant that has one carries it. Nothing here persists. The editor
 * recomputes the changes against the live document on every transaction, and
 * a review nobody accepts leaves the source byte-identical.
 */
import type { DocumentState } from './document';

/** Who offered the proposal. The Agent panel, Humanize on a selection and
 *  the developer harness are the same mechanism with different provenance,
 *  so they are variants of one union rather than three review shapes. No
 *  variant carries anything beyond the tag: the host records no instruction
 *  behind a parked proposal, and a field nothing can fill is a lie the type
 *  would then bless. */
export type RevisionOrigin = { kind: 'agent' } | { kind: 'developer' } | { kind: 'humanize' };

/** The two ways to end a whole review at once. The document's own header bar
 *  and the Agent panel both drive these, so one review cannot be resolved two
 *  different ways depending on which surface the reader used. The surface
 *  holding the review registers them on its runtime; nobody else has them. */
export interface RevisionControls {
  acceptAll(): void;
  rejectAll(): void;
}

export interface RevisionReview {
  /** The `sha256:` token the proposal was computed against. A review whose
   *  base has moved is refused rather than applied to newer text. */
  readonly baseVersion: string;
  readonly id: string;
  readonly origin: RevisionOrigin;
  /** The proposed document body, with any leading frontmatter already
   *  stripped: raw frontmatter handed to the parser lands in the document as
   *  a thematic break and a heading. */
  readonly proposal: string;
}

export type DocumentRevision =
  | { kind: 'idle' }
  | { kind: 'starting'; review: RevisionReview }
  | { kind: 'reviewing'; pending: number; review: RevisionReview };

/** Why a proposal was not opened. A refusal is a value the caller reports,
 *  not an unchanged state it has to notice. */
export type RevisionRefusal =
  | 'frontmatter-changed'
  | 'not-editable'
  | 'no-changes'
  | 'review-in-progress'
  | 'stale-version';

export type RevisionStart =
  | { kind: 'started'; state: DocumentState }
  | { kind: 'refused'; reason: RevisionRefusal };

export function documentRevisionActive(state: DocumentState): boolean {
  return state.revision.kind !== 'idle';
}

/**
 * Opens `review` against the document's current body.
 *
 * A proposal identical to what is already there is refused, because the diff
 * plugin stays active with no change to resolve and its transaction filter
 * then blocks every edit: the editor would be locked with nothing in the
 * document to click.
 */
export function startDocumentRevision(
  state: DocumentState,
  review: RevisionReview,
  currentBody: string,
): RevisionStart {
  const editor = state.editor;
  if (state.lifecycle === 'disposed' || state.access !== 'editable' || !editor) {
    return { kind: 'refused', reason: 'not-editable' };
  }
  if (state.revision.kind !== 'idle') return { kind: 'refused', reason: 'review-in-progress' };
  if (editor.version !== review.baseVersion) {
    return { kind: 'refused', reason: 'stale-version' };
  }
  if (review.proposal === currentBody) return { kind: 'refused', reason: 'no-changes' };
  return { kind: 'started', state: { ...state, revision: { kind: 'starting', review } } };
}

/**
 * Records what the editor reports is still pending.
 *
 * The diff plugin is the only thing that knows this number, and it
 * deactivates itself once every change has been resolved, so a count of zero
 * is the review ending rather than a review with nothing in it. A count for a
 * review that is no longer open is dropped.
 */
export function publishDocumentRevisionCount(
  state: DocumentState,
  reviewId: string,
  pending: number,
): DocumentState {
  const revision = state.revision;
  if (revision.kind === 'idle' || revision.review.id !== reviewId) return state;
  if (pending <= 0) return clearDocumentRevision(state);
  if (revision.kind === 'reviewing' && revision.pending === pending) return state;
  return { ...state, revision: { kind: 'reviewing', pending, review: revision.review } };
}

/** Ends the review. Clearing twice is as safe as clearing once, because a
 *  tab close, a folder change and a shell remount can all reach it. */
export function clearDocumentRevision(state: DocumentState): DocumentState {
  return state.revision.kind === 'idle' ? state : { ...state, revision: { kind: 'idle' } };
}
