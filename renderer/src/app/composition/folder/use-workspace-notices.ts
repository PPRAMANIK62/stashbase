import { useMemo } from 'react';

import type { FailureView } from '@/shared/domain/feature-error';

/** One line the window shows above the workspace, with a dismissal when the
 *  reader can clear it themselves. The tone decides how loudly it is said:
 *  a request of the reader's that came back refused is an alert, a capability
 *  StashBase could not reach is a quiet status. */
export interface WorkspaceNotice {
  readonly message: string;
  readonly onDismiss: (() => void) | null;
  readonly tone: FailureView['tone'];
}

/**
 * The notice strip the window shows for refusals the reader did not ask about
 * directly.
 *
 * Two owners can raise one: a preparation command the shell ran on the
 * reader's behalf, which they may dismiss, and the host disagreeing about
 * which folder this window is on, which only resolves when the host answers
 * again. Composing them here keeps the layout free of the question.
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
        message: preparationFailure.message,
        onDismiss: dismissPreparationFailure,
        tone: preparationFailure.tone,
      });
    }
    // The host disagreeing about this window's folder is not the reader's
    // request coming back, so it is said as a capability that could not answer.
    if (hostFailure) notices.push({ message: hostFailure, onDismiss: null, tone: 'capability' });
    return notices;
  }, [dismissPreparationFailure, hostFailure, preparationFailure]);
}
