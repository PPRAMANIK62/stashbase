import { useMemo } from 'react';

import type { FailureView } from '@/shared/domain/feature-error';

/** One line the window shows above the workspace, with a dismissal when the
 *  reader can clear it themselves. The tone decides how loudly it is said:
 *  a request of the reader's that came back refused is an alert, a capability
 *  StashBase could not reach is a quiet status, and an `offer` is something
 *  optional the reader may take up or wave away. */
export interface WorkspaceNotice {
  /** Something to take up, beside the dismissal. An offer carries one; a
   *  refusal the reader can only acknowledge does not. */
  readonly action: { readonly label: string; readonly onAct: () => void } | null;
  /** What the dismissal reads as. A refusal is dismissed; an offer declined. */
  readonly dismissLabel: string;
  readonly message: string;
  readonly onDismiss: (() => void) | null;
  readonly tone: FailureView['tone'] | 'offer';
}

/** The one-time invitation to set up search by meaning, as the strip shows it.
 *  Null while there is nothing to offer. */
export interface SearchSetupOffer {
  decline(): void;
  setUp(): void;
}

/**
 * The notice strip the window shows for things the reader did not ask about
 * directly.
 *
 * Three owners can raise one: a preparation command the shell ran on the
 * reader's behalf, which they may dismiss; the host disagreeing about which
 * folder this window is on, which only resolves when the host answers again;
 * and the one-time invitation to set up search by meaning.
 *
 * The invitation lives here rather than in a dialog on purpose. Onboarding
 * must not gate first value, and a modal between the reader and the files they
 * just opened is exactly that gate. It is also last in the strip, because a
 * refusal of something the reader did try is more urgent than an offer of
 * something they have not asked for.
 */
export function useWorkspaceNotices(
  preparationFailure: FailureView | null,
  dismissPreparationFailure: () => void,
  hostFailure: string | null,
  searchSetup: SearchSetupOffer | null,
): readonly WorkspaceNotice[] {
  return useMemo(() => {
    const notices: WorkspaceNotice[] = [];
    if (preparationFailure) {
      notices.push({
        action: null,
        dismissLabel: 'Dismiss',
        message: preparationFailure.message,
        onDismiss: dismissPreparationFailure,
        tone: preparationFailure.tone,
      });
    }
    // The host disagreeing about this window's folder is not the reader's
    // request coming back, so it is said as a capability that could not answer.
    if (hostFailure) {
      notices.push({
        action: null,
        dismissLabel: 'Dismiss',
        message: hostFailure,
        onDismiss: null,
        tone: 'capability',
      });
    }
    if (searchSetup) {
      notices.push({
        action: { label: 'Choose a source', onAct: searchSetup.setUp },
        dismissLabel: 'Not now',
        message:
          'Search by meaning finds files even when the wording differs. It needs a hosted account or your own API key. Keyword search works without it.',
        onDismiss: searchSetup.decline,
        tone: 'offer',
      });
    }
    return notices;
  }, [dismissPreparationFailure, hostFailure, preparationFailure, searchSetup]);
}
