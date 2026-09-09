/**
 * One reader-facing sentence per Agent refusal.
 *
 * A hook or a view reports a refusal by what it means rather than by whatever
 * sentence the transport happened to attach, and the map covers the whole
 * ladder, so adding a kind fails the build here. Both Agent ladders are
 * covered: a session failure can only be one of the shared transport kinds.
 */
import {
  isFeatureError,
  readFailure,
  type FailureView,
  type FeatureFailureKind,
} from '@/shared/domain/feature-error';

/** Refusals only the Agent's context resolution can meet: the file is gone, or
 *  its format is one the Agent cannot be given. */
export type AgentContextExtra = 'not-found' | 'unsupported';

export type AgentContextErrorKind = FeatureFailureKind<AgentContextExtra>;

const MESSAGES: Readonly<Record<AgentContextErrorKind, string>> = {
  'invalid-response': 'The Agent service returned an unexpected response.',
  'not-found': 'That file is no longer in this folder.',
  'scope-lost': 'That folder is no longer available in this window.',
  unauthorized: 'This window can no longer perform that action.',
  unsupported: 'This file type cannot be given to the Agent.',
  unavailable: 'StashBase could not reach the Agent service.',
};

/** A file the reader picked that the Agent cannot take is theirs to change;
 *  everything else is a capability that could not answer. */
const INPUT_KINDS: readonly AgentContextErrorKind[] = ['not-found', 'unsupported'];

/** The sentence one kind reads as. */
export function failureMessage(kind: AgentContextErrorKind): string {
  return MESSAGES[kind];
}

/** The kind behind a rejection, for the few decisions that turn on which
 *  refusal it was rather than on what to tell the reader. A failure this
 *  feature raised names its own; anything else is a capability that could not
 *  be reached. */
export function failureKind(error: unknown): AgentContextErrorKind {
  return isFeatureError<AgentContextExtra>(error) ? error.kind : 'unavailable';
}

/** What a replay that could not be read leaves on the conversation. The
 *  transport's own kind decides the rest of the ladder; a replay that arrives
 *  malformed is the one outcome none of those kinds names. */
export const RESTORE_FAILED = 'That conversation could not be restored.';

/** The sentence and tone a refusal shows, without repeating what it was thrown
 *  with. */
export function agentFailure(error: unknown): FailureView {
  return readFailure<AgentContextExtra>(error, MESSAGES, { inputKinds: INPUT_KINDS });
}
