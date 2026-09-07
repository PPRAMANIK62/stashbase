import type { Agent, AgentBootstrapFailureStage } from '@/shared/agent-runtime';

/** The four staged-preparation segments the track renders, in order — plus
 *  the two boundary states (not yet started, fully ready) that own no
 *  segment of their own. */
export type AgentRuntimeStage = 'discover' | 'install' | 'authenticate' | 'configure' | 'ready';

export type AgentRuntimeActionKind = 'install' | 'login' | 'account' | 'retry';

export interface AgentRuntimeAction {
  kind: AgentRuntimeActionKind;
  label: string;
}

export interface AgentRuntimeStatus {
  description: string;
  failed: boolean;
  /** `null` only while the catalog hasn't loaded this agent row at all. */
  stage: AgentRuntimeStage | null;
  stageIndex: 0 | 1 | 2 | 3 | 4;
  action: AgentRuntimeAction | null;
}

const STAGE_INDEX: Record<AgentRuntimeStage, 0 | 1 | 2 | 3 | 4> = {
  discover: 0,
  install: 1,
  authenticate: 2,
  configure: 3,
  ready: 4,
};

function failureStage(stage: AgentBootstrapFailureStage | undefined): AgentRuntimeStage {
  switch (stage) {
    case 'installation':
      return 'install';
    case 'authentication':
      return 'authenticate';
    case 'mcp':
      return 'configure';
    case 'discovery':
    default:
      return 'discover';
  }
}

function sourceLabel(source: Agent['source']): string {
  if (source === 'bundled') return 'Included with StashBase';
  if (source === 'managed') return 'StashBase-managed runtime';
  return 'System runtime';
}

/**
 * Unifies the old app's `runtimeAction` and `runtimeDescription` into one
 * derivation, so a runtime's description, failure flag, staged-progress
 * position, and single applicable action can never disagree with each other.
 */
export function describeRuntime(agent: Agent | undefined, busy: boolean): AgentRuntimeStatus {
  if (!agent) {
    return { description: 'Checking…', failed: false, stage: null, stageIndex: 0, action: null };
  }

  if (agent.bootstrap?.phase === 'failed') {
    const failure = agent.bootstrap.failure;
    const stage = failureStage(failure?.stage);
    const action: AgentRuntimeAction | null = busy
      ? null
      : failure?.code === 'account-required'
        ? { kind: 'account', label: 'Sign in' }
        : failure?.stage === 'authentication'
          ? { kind: 'login', label: 'Sign in' }
          : { kind: 'retry', label: failure?.stage === 'mcp' ? 'Retry connection' : 'Retry' };
    return {
      description: failure?.message ?? 'Setup failed',
      failed: true,
      stage,
      stageIndex: STAGE_INDEX[stage],
      action,
    };
  }

  const preparingStage: AgentRuntimeStage | undefined =
    agent.bootstrap?.phase === 'installing'
      ? 'install'
      : agent.bootstrap?.phase === 'authenticating'
        ? 'authenticate'
        : agent.bootstrap?.phase === 'configuring'
          ? 'configure'
          : undefined;
  if (preparingStage) {
    return {
      description: agent.bootstrap?.message ?? 'Preparing…',
      failed: false,
      stage: preparingStage,
      stageIndex: STAGE_INDEX[preparingStage],
      action: null,
    };
  }

  if (!agent.installed) {
    return {
      description: 'Not installed',
      failed: false,
      stage: 'discover',
      stageIndex: 0,
      action: busy ? null : { kind: 'install', label: 'Install' },
    };
  }

  const label = sourceLabel(agent.source);
  return {
    description: agent.bootstrap?.phase === 'ready' ? `Ready for Chat · ${label}` : label,
    failed: false,
    stage: 'ready',
    stageIndex: 4,
    action: null,
  };
}
