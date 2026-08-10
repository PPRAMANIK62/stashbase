export const AGENT_TURN_FAILED_MESSAGE = 'The Agent turn failed before returning a response.';

export interface TerminalTurnResult {
  duplicate: boolean;
  failureMessage: string | null;
}

/**
 * Tracks whether the active turn already has a visible explanation and whether
 * its terminal event has been handled. Runtime errors win over the generic
 * fallback, and duplicate terminal events cannot advance the prompt queue.
 */
export class TurnErrorTracker {
  private explained = false;
  private ended = false;

  start(): void {
    this.explained = false;
    this.ended = false;
  }

  explain(): void {
    this.explained = true;
  }

  finish(isError: boolean): TerminalTurnResult {
    if (this.ended) return { duplicate: true, failureMessage: null };
    this.ended = true;

    if (!isError || this.explained) {
      return { duplicate: false, failureMessage: null };
    }

    this.explained = true;
    return { duplicate: false, failureMessage: AGENT_TURN_FAILED_MESSAGE };
  }
}

/**
 * Keep the failure attached to the turn that produced it. React preserves the
 * order of these queued state updates, so the next user block is appended only
 * after the terminal failure notice.
 */
export function recordFailureBeforeContinuing(
  terminal: TerminalTurnResult,
  appendFailure: (message: string) => void,
  continueQueue: () => void,
): void {
  if (terminal.duplicate) return;
  if (terminal.failureMessage) appendFailure(terminal.failureMessage);
  continueQueue();
}
