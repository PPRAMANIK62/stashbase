import type { AgentKind, AgentTurnFailureKind } from '@/features/agent-panel/lib/types';

export const AGENT_TURN_FAILED_MESSAGE = 'The Agent turn failed before returning a response.';

export type TurnFailureActionId = 'codex-sign-in' | 'reconnect' | 'resend' | 'open-agent-settings';

export interface TurnFailureGuidance {
  title: string;
  guidance: string;
  /** In-app recovery. `codex-sign-in` starts the provider-owned browser
   * flow without handling credentials. `reconnect` restarts this session's
   * native process (resuming the same conversation): credentials are read
   * at process start, so a login completed in the terminal is invisible to
   * the already-running process until it is replaced. `resend` retries the
   * failed prompt on the live session — quota, rate, and network failures
   * clear on the provider side, so no process replacement is needed.
   * Acting on any of them settles the card to a plain message — a stale
   * button must not outlive the state it described. */
  action: { id: TurnFailureActionId; label: string };
}

/** Map a classified turn failure to its truthful recovery. The renderer
 * switches on the adapter-assigned kind only — never on message prose. */
export function turnFailureGuidance(kind: AgentTurnFailureKind, agent: AgentKind): TurnFailureGuidance {
  const runtimeName = agent === 'stashbase' ? 'Built-in' : agent === 'codex' ? 'Codex' : 'Claude';
  switch (kind) {
    case 'rate-limit':
      return {
        title: 'Rate limited',
        guidance: 'The provider is temporarily limiting requests. Wait a moment, then try again.',
        action: { id: 'resend', label: 'Try again' },
      };
    case 'quota':
      return {
        title: 'Usage limit reached',
        guidance: agent === 'stashbase'
          ? 'Built-in reached a provider usage limit. Wait for the provider’s reset or choose another Agent, then try again.'
          : `Your ${agent === 'codex' ? 'ChatGPT' : 'Claude'} plan’s usage is used up for now. Wait for the provider’s reset or upgrade the plan, then try again.`,
        action: { id: 'resend', label: 'Try again' },
      };
    case 'allowance-exhausted':
      return {
        title: '7-day Agent allowance used',
        guidance: 'Wait for the current 7-day window to reset, choose your own Codex or Claude Code runtime, or review Agent usage in Settings.',
        action: { id: 'open-agent-settings', label: 'Open Agent settings' },
      };
    case 'access-restricted':
      return {
        title: 'Hosted Agent access restricted',
        guidance: 'This account cannot use hosted Agent capacity. Review Agent Settings for alternatives or contact StashBase support.',
        action: { id: 'open-agent-settings', label: 'Open Agent settings' },
      };
    case 'auth-expired':
      return agent === 'stashbase'
        ? {
            title: 'StashBase sign-in expired',
            guidance: 'Sign in to StashBase again from Agent Settings to continue with the included allowance.',
            action: { id: 'open-agent-settings', label: 'Open Agent settings' },
          }
        : agent === 'codex'
        ? {
            title: 'Signed out of Codex',
            guidance: 'Your ChatGPT sign-in has expired. Sign in again to continue this conversation.',
            action: { id: 'codex-sign-in', label: 'Sign in with ChatGPT' },
          }
        : {
            title: 'Signed out of Claude Code',
            guidance: 'Sign in from a terminal: run "claude" and enter "/login". Once signed in, reconnect to continue this conversation.',
            action: { id: 'reconnect', label: 'Reconnect' },
          };
    case 'network':
      return {
        title: 'Connection problem',
        guidance: `${runtimeName} couldn’t reach its provider. Check your network, then try again.`,
        action: { id: 'resend', label: 'Try again' },
      };
  }
}

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
