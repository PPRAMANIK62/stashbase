import type { ActiveLibraryFolder } from './library';

export interface WorkspaceScope {
  readonly folder: ActiveLibraryFolder;
  readonly generation: number;
}

export interface WorkspaceState {
  lifecycle: 'active' | 'disposed';
  scope: WorkspaceScope;
}

export function createWorkspaceState(scope: WorkspaceScope): WorkspaceState {
  return { lifecycle: 'active', scope };
}

export function disposeWorkspaceState(state: WorkspaceState): WorkspaceState {
  return state.lifecycle === 'disposed' ? state : { ...state, lifecycle: 'disposed' };
}
