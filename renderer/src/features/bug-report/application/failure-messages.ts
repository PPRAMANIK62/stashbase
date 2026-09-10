/**
 * One reader-facing sentence per refusal the review can meet.
 *
 * The session stores failure kinds, never text, so this is the only place a
 * sentence is authored. The map covers the whole ladder: a new kind fails the
 * build here rather than shipping a blank status line.
 */
import type { ReviewFailureKind } from '@/features/bug-report/domain/review-session';

const MESSAGES: Readonly<Record<ReviewFailureKind, string>> = {
  'artifact-unavailable': 'That attachment is no longer available for this report.',
  'description-invalid': 'The description could not be accepted. Shorten it and try again.',
  'downloads-failed': 'The files could not be saved to Downloads.',
  'draft-gone': 'This report is no longer available. Close this window and start again.',
  'github-open-failed': 'StashBase could not open GitHub.',
  'invalid-response': 'The bug report review returned an unexpected response.',
  'prepare-failed': 'The report could not be prepared. Try again.',
  privacy: 'The report could not be prepared because a privacy check did not pass.',
  'scope-lost': 'This report is no longer available in this window.',
  unauthorized: 'This window can no longer review the report.',
  unavailable: 'The bug report review is unavailable. Try again.',
  'wrong-state': 'The report changed state. Go back and try again.',
};

export function failureMessage(kind: ReviewFailureKind): string {
  return MESSAGES[kind];
}
