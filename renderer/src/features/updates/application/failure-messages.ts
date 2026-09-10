/**
 * Every sentence a reader sees for a refused update command.
 *
 * There is nothing to forward from the transport here. A snapshot carries no
 * installer diagnostic and the wire carries none either, so the kind is the
 * whole story: two refusals, one line each. Both read as a capability that
 * could not answer rather than as input to correct, because neither is
 * anything the reader typed.
 */
import type { UpdateRefusal } from '@/features/updates/application/ports';
import type { FailureView } from '@/shared/domain/feature-error';

const MESSAGES: Readonly<Record<UpdateRefusal, string>> = {
  unauthorized: 'This window is not allowed to manage updates.',
  unavailable: 'StashBase could not reach the updater.',
};

export function updateFailure(kind: UpdateRefusal): FailureView {
  return { message: MESSAGES[kind], tone: 'capability' };
}
