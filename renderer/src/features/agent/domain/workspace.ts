import { agentScopesEqual, type AgentId, type AgentScope, type AgentSessionPhase } from './session';

export interface AgentTabState {
  agent: AgentId;
  blank: boolean;
  hasContent: boolean;
  id: string;
  lastModified: number;
  nativeSessionId: string | null;
  phase: AgentSessionPhase;
  scope: AgentScope;
  title: string;
}

export interface AgentWorkspaceState {
  activeId: string;
  disposed: boolean;
  tabs: AgentTabState[];
}

export function createAgentWorkspaceState(activeId: string): AgentWorkspaceState {
  return { activeId, disposed: false, tabs: [] };
}

export function upsertAgentTab(
  state: AgentWorkspaceState,
  tab: AgentTabState,
): AgentWorkspaceState {
  return {
    ...state,
    tabs: state.tabs.some((candidate) => candidate.id === tab.id)
      ? state.tabs.map((candidate) => (candidate.id === tab.id ? tab : candidate))
      : [...state.tabs, tab],
  };
}

export function activateAgentTab(state: AgentWorkspaceState, id: string): AgentWorkspaceState {
  return state.activeId === id ? state : { ...state, activeId: id };
}

export function removeAgentTab(
  state: AgentWorkspaceState,
  id: string,
  visibleScope: AgentScope,
): AgentWorkspaceState {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  const tabs = state.tabs.filter((tab) => tab.id !== id);
  if (state.activeId !== id) return { ...state, tabs };

  const candidates: AgentTabState[] = [];
  for (
    let candidateIndex = Math.min(index - 1, tabs.length - 1);
    candidateIndex >= 0;
    candidateIndex -= 1
  ) {
    const candidate = tabs[candidateIndex];
    if (candidate) candidates.push(candidate);
  }
  for (let candidateIndex = Math.max(0, index); candidateIndex < tabs.length; candidateIndex += 1) {
    const candidate = tabs[candidateIndex];
    if (candidate) candidates.push(candidate);
  }
  const next = candidates.find((tab) => agentScopesEqual(tab.scope, visibleScope));
  return { ...state, activeId: next?.id ?? '', tabs };
}

export function disposeAgentWorkspace(state: AgentWorkspaceState): AgentWorkspaceState {
  return { ...state, disposed: true };
}
