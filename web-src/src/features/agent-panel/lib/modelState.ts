import type { AgentKind } from '@/common/lib/agentCatalog';
import type { AgentModel } from '@/features/agent-panel/lib/types';

export interface ModelControlState {
  models: AgentModel[];
  /** Explicit user intent. `null` means native Default; `undefined` means
   * there is no pending choice and runtime telemetry may name the model. */
  selectedModel?: string | null;
  /** Model the runtime says this live session is actually using. */
  activeModel?: string;
  notice: string | null;
  resumedSession: boolean;
}

export function applyModelEvent(state: ModelControlState, event: {
  models: AgentModel[];
  activeModel?: string;
  fallback?: string;
}): ModelControlState {
  if (event.fallback) {
    return {
      ...state,
      models: event.models,
      selectedModel: undefined,
      notice: event.fallback,
      ...(event.activeModel ? { activeModel: event.activeModel } : {}),
    };
  }
  return {
    ...state,
    models: event.models,
    // Keep a fallback explanation visible even when the runtime follows with
    // its Default model in an init event.
    ...(event.activeModel ? { activeModel: event.activeModel } : {}),
  };
}

export function modelMenuVisible(runtimeSupportsModels: boolean, models: AgentModel[]): boolean {
  return runtimeSupportsModels && models.length > 0;
}

export type ModelMenuLockReason = 'available after the current response' | 'fixed for this conversation' | null;

export function modelMenuLockReason(
  hasTranscript: boolean,
  turnActive: boolean,
  agent: AgentKind,
): ModelMenuLockReason {
  if (turnActive) return 'available after the current response';
  return hasTranscript && agent !== 'codex' ? 'fixed for this conversation' : null;
}

export function modelMenuLocked(hasTranscript: boolean, turnActive: boolean, agent: AgentKind): boolean {
  return modelMenuLockReason(hasTranscript, turnActive, agent) !== null;
}

export function modelMenuLabel(
  models: AgentModel[],
  selectedModel: string | null | undefined,
  activeModel: string | undefined,
  resumedSession: boolean,
): string {
  // Explicit intent wins over telemetry: once the user picks a model for
  // the next session, the pill must show that pick even while the runtime
  // still reports the session's (or catalog's) default identity.
  if (selectedModel === null) return 'Default';
  const identity = selectedModel ?? activeModel;
  return models.find((entry) => entry.id === identity)?.label ?? (resumedSession ? 'Session model' : 'Default');
}
