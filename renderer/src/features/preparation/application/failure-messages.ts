/**
 * One reader-facing sentence per preparation refusal.
 *
 * Preparation controls are explicit and never optimistic, so a refusal has to
 * say what state the source is actually in. Views and hooks ask here instead of
 * forwarding an adapter's own sentence, and the map covers the whole ladder, so
 * a new kind fails the build rather than shipping blank.
 *
 * `blocked` is the one kind that keeps the daemon's own sentence: setup is
 * something only the user can complete, and the server names the exact missing
 * piece, which no fixed line here can.
 */
import type { PreparationFailureKind } from '@/features/preparation/application/ports';
import { readFailure, type FailureView } from '@/shared/domain/feature-error';

const MESSAGES: Readonly<Record<PreparationFailureKind, string>> = {
  blocked: 'Transcription setup is required before this file can be prepared.',
  'invalid-response': 'StashBase returned an unexpected response.',
  'scope-lost': 'This file is no longer available in this window.',
  unauthorized: 'This window can no longer prepare files.',
  unavailable: 'Preparation is unavailable. Try again.',
  unsupported: 'This file format cannot be prepared.',
};

type PreparationExtra = 'blocked' | 'unsupported';

/** Setup the reader has to complete, and a format they chose that cannot be
 *  prepared, are both theirs to act on rather than a capability being gone. */
const INPUT_KINDS: readonly PreparationFailureKind[] = ['blocked', 'unsupported'];

/** The sentence and tone one refusal shows. Anything that is not a preparation
 *  failure — a transport that threw, or a bug — reads as the unavailable line. */
export function preparationFailure(error: unknown): FailureView {
  return readFailure<PreparationExtra>(error, MESSAGES, {
    inputKinds: INPUT_KINDS,
    owner: 'PreparationError',
    serverSentenceFor: ['blocked'],
  });
}
