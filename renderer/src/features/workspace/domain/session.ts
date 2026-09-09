/**
 * The durable shape of a workspace session: which folders were open, what each
 * one had expanded and selected, and the pane widths the window restores. Every
 * bound here is a restore-time guard — a snapshot read back from disk is
 * untrusted input, so it is clamped and truncated rather than believed.
 */
import type { WorkspaceState } from './workspace';

const WORKSPACE_SESSION_VERSION = 1 as const;
const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 360;
/** The Agent pane's remembered width and the bounds it is clamped to. One
 *  record, because a caller that reads one of these always reads the others. */
export const AGENT_PANE_WIDTH = {
  default: 576,
  max: 960,
  min: 320,
} as const;
const MAX_SESSION_FOLDERS = 32;
const MAX_SESSION_EXPANDED_PATHS = 2_048;
const MAX_SESSION_TABS = 50;

interface WorkspaceTabIdentity {
  id: string;
  path: string;
}

export interface WorkspaceDocumentSession {
  activeTabId: string | null;
  tabs: WorkspaceTabIdentity[];
}

export interface FolderSessionState {
  activeTabId: string | null;
  expandedPaths: string[];
  folderPath: string;
  selectedPath: string | null;
  tabs: WorkspaceTabIdentity[];
}

interface WorkspaceShellSessionState {
  agentPaneWidth: number;
  sidebarOpen: boolean;
  sidebarWidth: number;
}

export interface WorkspaceSessionSnapshot {
  activeFolderPath: string | null;
  folders: FolderSessionState[];
  shell: WorkspaceShellSessionState;
  version: typeof WORKSPACE_SESSION_VERSION;
}

export function createWorkspaceSessionSnapshot(): WorkspaceSessionSnapshot {
  return {
    activeFolderPath: null,
    folders: [],
    shell: {
      agentPaneWidth: AGENT_PANE_WIDTH.default,
      sidebarOpen: true,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    },
    version: WORKSPACE_SESSION_VERSION,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function normalizeFolder(folder: FolderSessionState): FolderSessionState {
  const seenTabs = new Set<string>();
  const tabs = folder.tabs.filter((tab) => {
    if (seenTabs.has(tab.id)) return false;
    seenTabs.add(tab.id);
    return true;
  });
  return {
    ...folder,
    activeTabId: tabs.some((tab) => tab.id === folder.activeTabId) ? folder.activeTabId : null,
    expandedPaths: unique(folder.expandedPaths),
    tabs,
  };
}

export function normalizeWorkspaceSession(
  snapshot: WorkspaceSessionSnapshot,
): WorkspaceSessionSnapshot {
  const seenFolders = new Set<string>();
  const folders = snapshot.folders.flatMap((folder) => {
    if (seenFolders.has(folder.folderPath)) return [];
    seenFolders.add(folder.folderPath);
    return [normalizeFolder(folder)];
  });
  return {
    ...snapshot,
    activeFolderPath:
      snapshot.activeFolderPath && seenFolders.has(snapshot.activeFolderPath)
        ? snapshot.activeFolderPath
        : null,
    folders,
    shell: {
      agentPaneWidth: clampAgentPaneWidth(snapshot.shell.agentPaneWidth),
      sidebarOpen: snapshot.shell.sidebarOpen,
      sidebarWidth: Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(MAX_SIDEBAR_WIDTH, Math.round(snapshot.shell.sidebarWidth)),
      ),
    },
    version: WORKSPACE_SESSION_VERSION,
  };
}

export function restoreFolderSession(
  snapshot: WorkspaceSessionSnapshot,
  folderPath: string,
): FolderSessionState | null {
  return snapshot.folders.find((folder) => folder.folderPath === folderPath) ?? null;
}

export function setSessionActiveFolder(
  snapshot: WorkspaceSessionSnapshot,
  folderPath: string | null,
): WorkspaceSessionSnapshot {
  if (snapshot.activeFolderPath === folderPath) return snapshot;
  const folders =
    folderPath && !snapshot.folders.some((folder) => folder.folderPath === folderPath)
      ? [
          ...snapshot.folders.slice(-(MAX_SESSION_FOLDERS - 1)),
          {
            activeTabId: null,
            expandedPaths: [],
            folderPath,
            selectedPath: null,
            tabs: [],
          },
        ]
      : snapshot.folders;
  return { ...snapshot, activeFolderPath: folderPath, folders };
}

export function reconcileSessionMembership(
  snapshot: WorkspaceSessionSnapshot,
  memberPaths: readonly string[],
): WorkspaceSessionSnapshot {
  const members = new Set(memberPaths);
  const folders = snapshot.folders.filter((folder) => members.has(folder.folderPath));
  const activeFolderPath =
    snapshot.activeFolderPath && members.has(snapshot.activeFolderPath)
      ? snapshot.activeFolderPath
      : null;
  if (
    activeFolderPath === snapshot.activeFolderPath &&
    folders.length === snapshot.folders.length
  ) {
    return snapshot;
  }
  return { ...snapshot, activeFolderPath, folders };
}

export function recordFolderSession(
  snapshot: WorkspaceSessionSnapshot,
  workspace: WorkspaceState,
  documents?: WorkspaceDocumentSession,
): WorkspaceSessionSnapshot {
  const folderPath = workspace.scope.folder.path;
  const previous = snapshot.folders.find((candidate) => candidate.folderPath === folderPath);
  const documentSession = documents ?? previous ?? { activeTabId: null, tabs: [] };
  const folder: FolderSessionState = {
    activeTabId: documentSession.activeTabId,
    expandedPaths: Object.keys(workspace.expanded)
      .filter((path) => workspace.expanded[path] === true)
      .slice(-MAX_SESSION_EXPANDED_PATHS),
    folderPath,
    selectedPath: workspace.selectedPath,
    tabs: documentSession.tabs
      .slice(-MAX_SESSION_TABS)
      .map((tab) => ({ id: tab.id, path: tab.path })),
  };
  folder.activeTabId = folder.tabs.some((tab) => tab.id === documentSession.activeTabId)
    ? documentSession.activeTabId
    : null;
  const index = snapshot.folders.findIndex((candidate) => candidate.folderPath === folderPath);
  const folders = [...snapshot.folders];
  if (index === -1) {
    if (folders.length >= MAX_SESSION_FOLDERS) folders.shift();
    folders.push(folder);
  } else folders[index] = folder;
  return { ...snapshot, folders };
}

export function setSessionSidebarOpen(
  snapshot: WorkspaceSessionSnapshot,
  sidebarOpen: boolean,
): WorkspaceSessionSnapshot {
  return snapshot.shell.sidebarOpen === sidebarOpen
    ? snapshot
    : { ...snapshot, shell: { ...snapshot.shell, sidebarOpen } };
}

function clampAgentPaneWidth(width: number): number {
  return Math.max(AGENT_PANE_WIDTH.min, Math.min(AGENT_PANE_WIDTH.max, Math.round(width)));
}

export function setSessionAgentPaneWidth(
  snapshot: WorkspaceSessionSnapshot,
  agentPaneWidth: number,
): WorkspaceSessionSnapshot {
  const clamped = clampAgentPaneWidth(agentPaneWidth);
  return snapshot.shell.agentPaneWidth === clamped
    ? snapshot
    : { ...snapshot, shell: { ...snapshot.shell, agentPaneWidth: clamped } };
}

export function setSessionSidebarWidth(
  snapshot: WorkspaceSessionSnapshot,
  sidebarWidth: number,
): WorkspaceSessionSnapshot {
  const clamped = Math.max(
    MIN_SIDEBAR_WIDTH,
    Math.min(MAX_SIDEBAR_WIDTH, Math.round(sidebarWidth)),
  );
  return snapshot.shell.sidebarWidth === clamped
    ? snapshot
    : { ...snapshot, shell: { ...snapshot.shell, sidebarWidth: clamped } };
}
