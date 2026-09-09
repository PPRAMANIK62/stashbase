/**
 * One runtime row's staged-preparation state.
 *
 * The stage order is the single source of both the copy and the track: the
 * position a segment fills is read back out of `AGENT_RUNTIME_STAGES`, so a
 * status can no longer carry a stage and an index that disagree.
 */
import {
  AGENT_RUNTIME_STAGES,
  type AgentRuntime,
  type AgentRuntimeStage,
} from '@/features/settings/domain/agent-catalog';

/** What a row says when the daemon sent no note of its own. The daemon's note
 *  names the exact step, so it is preferred wherever there is one — the same
 *  rule a server-authored refusal sentence follows. */
const PREPARATION_FAILED = 'Setup failed';
const PREPARING = 'Preparing…';

/** Where a stage sits on the track. Derived, never stored beside the stage. */
export function agentRuntimeStageIndex(stage: AgentRuntimeStage): number {
  return AGENT_RUNTIME_STAGES.indexOf(stage);
}

type AgentRuntimeActionKind = 'install' | 'login' | 'account' | 'retry';

export interface AgentRuntimeAction {
  readonly kind: AgentRuntimeActionKind;
  readonly label: string;
}

export interface AgentRuntimeStatus {
  readonly description: string;
  readonly failed: boolean;
  /** `null` only while the catalog hasn't loaded this agent row at all. */
  readonly stage: AgentRuntimeStage | null;
  readonly action: AgentRuntimeAction | null;
}

function ownershipLabel(ownership: AgentRuntime['ownership']): string {
  if (ownership === 'bundled') return 'Included with StashBase';
  if (ownership === 'managed') return 'StashBase-managed runtime';
  return 'System runtime';
}

/**
 * Unifies the old app's `runtimeAction` and `runtimeDescription` into one
 * derivation, so a runtime's description, failure flag, staged-progress
 * position, and single applicable action can never disagree with each other.
 */
export function describeRuntime(
  runtime: AgentRuntime | undefined,
  busy: boolean,
): AgentRuntimeStatus {
  if (!runtime) {
    return { description: 'Checking…', failed: false, stage: null, action: null };
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
      failed: true,
      stage: failure.stage,
      action,
    };
  }

  if (preparation.kind === 'running') {
    return {
      description: preparation.note ?? PREPARING,
      failed: false,
      stage: preparation.stage,
      action: null,
    };
  }

  if (!runtime.installed) {
    return {
      description: 'Not installed',
      failed: false,
      stage: 'discover',
      action: busy ? null : { kind: 'install', label: 'Install' },
    };
  }

  const label = ownershipLabel(runtime.ownership);
  return {
    description: preparation.kind === 'ready' ? `Ready for Chat · ${label}` : label,
    failed: false,
    stage: 'ready',
    action: null,
  };
}
