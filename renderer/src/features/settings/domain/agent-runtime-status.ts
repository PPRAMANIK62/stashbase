/**
 * One runtime row's staged-preparation state.
 *
 * A row says where preparation stands in one sentence and offers the single
 * action that applies there. The stage it reports is the daemon's own, so the
 * copy and the action can never name different steps.
 */
import type { AgentRuntime, AgentRuntimeStage } from '@/features/settings/domain/agent-catalog';

/** What a row says when the daemon sent no note of its own. The daemon's note
 *  names the exact step, so it is preferred wherever there is one — the same
 *  rule a server-authored refusal sentence follows. */
const PREPARATION_FAILED = 'Setup failed';
const PREPARING = 'Preparing…';

type AgentRuntimeActionKind = 'install' | 'login' | 'account' | 'retry';

export interface AgentRuntimeAction {
  readonly kind: AgentRuntimeActionKind;
  readonly label: string;
}

export interface AgentRuntimeStatus {
  readonly description: string;
  /** Where preparation stands. `null` only while the catalog hasn't loaded
   *  this agent row at all. */
  readonly stage: AgentRuntimeStage | null;
  readonly action: AgentRuntimeAction | null;
}

function ownershipLabel(ownership: AgentRuntime['ownership']): string {
  if (ownership === 'bundled') return 'Included with StashBase';
  return 'Installed on your system';
}

/**
 * Unifies the old app's `runtimeAction` and `runtimeDescription` into one
 * derivation, so a runtime's description, the step it stands on, and the
 * single applicable action can never disagree with each other.
 */
export function describeRuntime(
  runtime: AgentRuntime | undefined,
  busy: boolean,
): AgentRuntimeStatus {
  if (!runtime) {
    return { description: 'Checking…', stage: null, action: null };
  }

  const preparation = runtime.preparation;
  if (preparation.kind === 'failed') {
    const failure = preparation.failure;
    const action: AgentRuntimeAction | null = busy
      ? null
      : failure.refusal === 'account-required'
        ? { kind: 'account', label: 'Sign in' }
        : failure.stage === 'authenticate'
          ? { kind: 'login', label: 'Sign in' }
          : { kind: 'retry', label: failure.stage === 'configure' ? 'Retry connection' : 'Retry' };
    return {
      description: failure.note ?? PREPARATION_FAILED,
      stage: failure.stage,
      action,
    };
  }

  if (preparation.kind === 'running') {
    return {
      description: preparation.note ?? PREPARING,
      stage: preparation.stage,
      action: null,
    };
  }

  if (!runtime.installed) {
    return {
      description: 'Not installed',
      stage: 'discover',
      action: busy ? null : { kind: 'install', label: 'Install' },
    };
  }

  const label = ownershipLabel(runtime.ownership);
  return {
    description: preparation.kind === 'ready' ? `Ready to chat · ${label}` : label,
    stage: 'ready',
    action: null,
  };
}
