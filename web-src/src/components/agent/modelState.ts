import type { AgentModel } from './types';

export interface ModelControlState {
  models: AgentModel[];
  model?: string;
  notice: string | null;
  resumedSession: boolean;
}

export function applyModelEvent(state: ModelControlState, event: {
  models: AgentModel[];
  activeModel?: string;
  fallback?: string;
}): ModelControlState {
  if (event.fallback) return { ...state, models: event.models, model: undefined, notice: event.fallback };
  return {
    ...state,
    models: event.models,
    ...(event.activeModel ? { model: event.activeModel, notice: null } : {}),
  };
}

export function modelMenuVisible(runtimeSupportsModels: boolean, models: AgentModel[]): boolean {
  return runtimeSupportsModels && models.length > 0;
}

export function modelMenuLocked(hasTranscript: boolean, turnActive: boolean): boolean {
  return hasTranscript || turnActive;
}

export function modelMenuLabel(models: AgentModel[], model: string | undefined, resumedSession: boolean): string {
  return models.find((entry) => entry.id === model)?.label ?? (resumedSession ? 'Session model' : 'Default');
}
