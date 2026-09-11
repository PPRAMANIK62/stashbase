import { useMemo } from 'react';

import type { FailureView } from '@/shared/domain/feature-error';

/** One line the window shows above the workspace, with a dismissal when the
 *  reader can clear it themselves. The tone decides how loudly it is said:
 *  a request of the reader's that came back refused is an alert, and a
 *  capability StashBase could not reach is a quiet status. */
export interface WorkspaceNotice {
  /** Something to take up, beside the dismissal. A refusal the reader can only
   *  acknowledge carries none. */
  readonly action: { readonly label: string; readonly onAct: () => void } | null;
  readonly dismissLabel: string;
  readonly message: string;
  readonly onDismiss: (() => void) | null;
  readonly tone: FailureView['tone'];
}

/**
 * The notice strip the window shows for things the reader did not ask about
 * directly.
 *
 * Two owners can raise one: a preparation command the shell ran on the
 * reader's behalf, which they may dismiss, and the host disagreeing about
 * which folder this window is on, which only resolves when the host answers
 * again. Nothing here offers setup: the strip carries only what happened to
 * the reader's own work, never an invitation to turn something on.
 */
export function useWorkspaceNotices(
  preparationFailure: FailureView | null,
  dismissPreparationFailure: () => void,
  hostFailure: string | null,
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
    return notices;
  }, [dismissPreparationFailure, hostFailure, preparationFailure]);
}
