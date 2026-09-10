import type { ActiveLibraryFolder } from './library';
import type { FolderSessionState } from './session';
import { renamedTreePath, treePathWithin, type ExpandedFolders } from './tree';

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

export function createWorkspaceState(
  scope: WorkspaceScope,
  restored: FolderSessionState | null = null,
): WorkspaceState {
  return {
    expanded: Object.fromEntries(restored?.expandedPaths.map((path) => [path, true]) ?? []),
    lifecycle: 'active',
    scope,
    selectedPath: restored?.selectedPath ?? null,
  };
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

export function expandTreeFolder(state: WorkspaceState, folderPath: string): WorkspaceState {
  return state.expanded[folderPath]
    ? state
    : { ...state, expanded: { ...state.expanded, [folderPath]: true } };
}

/** Moves expansion and selection with an entry that took a new leaf name,
 *  so a renamed folder stays open and its selected descendant stays selected. */
export function renameTreePath(
  state: WorkspaceState,
  entryPath: string,
  name: string,
): WorkspaceState {
  const nextPath = renamedTreePath(entryPath, name);
  if (nextPath === entryPath) return state;
  const move = (path: string) =>
    treePathWithin(path, entryPath) ? `${nextPath}${path.slice(entryPath.length)}` : path;
  const expanded: ExpandedFolders = {};
  for (const path of Object.keys(state.expanded)) expanded[move(path)] = true;
  return {
    ...state,
    expanded,
    selectedPath: state.selectedPath === null ? null : move(state.selectedPath),
  };
}

/** Drops expansion and selection under an entry that left the tree. */
export function forgetTreePath(state: WorkspaceState, entryPath: string): WorkspaceState {
  const expanded: ExpandedFolders = {};
  for (const path of Object.keys(state.expanded)) {
    if (!treePathWithin(path, entryPath)) expanded[path] = true;
  }
  const selectedPath =
    state.selectedPath !== null && treePathWithin(state.selectedPath, entryPath)
      ? null
      : state.selectedPath;
  return { ...state, expanded, selectedPath };
}
