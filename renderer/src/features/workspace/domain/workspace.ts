import type { ActiveLibraryFolder } from './library';
import type { ExpandedFolders } from './tree';

export interface WorkspaceScope {
  readonly folder: ActiveLibraryFolder;
  readonly generation: number;
}

export interface WorkspaceState {
  expanded: ExpandedFolders;
  lifecycle: 'active' | 'disposed';
  selectedPath: string | null;
  scope: WorkspaceScope;
}

export function createWorkspaceState(scope: WorkspaceScope): WorkspaceState {
  return { expanded: {}, lifecycle: 'active', scope, selectedPath: null };
}

export function disposeWorkspaceState(state: WorkspaceState): WorkspaceState {
  return state.lifecycle === 'disposed' ? state : { ...state, lifecycle: 'disposed' };
}

export function selectTreePath(state: WorkspaceState, selectedPath: string): WorkspaceState {
  return state.selectedPath === selectedPath ? state : { ...state, selectedPath };
}

export function toggleTreeFolder(state: WorkspaceState, folderPath: string): WorkspaceState {
  const expanded = { ...state.expanded };
  if (expanded[folderPath]) delete expanded[folderPath];
  else expanded[folderPath] = true;
  return { ...state, expanded };
}
