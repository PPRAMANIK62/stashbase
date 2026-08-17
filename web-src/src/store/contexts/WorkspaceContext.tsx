/**
 * Workspace slice: folder identity, the file tree, tabs, save/editor
 * registration, and folder-level indexing/preparation state. See the slice
 * map atop `state.ts` for the full field list and why each field landed
 * here rather than in `ChatContext` / `UiShellContext`.
 *
 * The provider memoizes its value on the individual fields it reads, not on
 * `state` itself, so a dispatch that only touches chat or ui-shell fields
 * does not change this context's value identity — consumers here don't
 * re-render for it.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getActiveTab, type State, type Tab } from '@/store/state/state';

export interface WorkspaceState {
  booted: State['booted'];
  folder: State['folder'];
  folderPath: State['folderPath'];
  recent: State['recent'];
  homeDir: State['homeDir'];
  libraryFolderStatuses: State['libraryFolderStatuses'];
  files: State['files'];
  folders: State['folders'];
  unsupportedFiles: State['unsupportedFiles'];
  unsupportedModalOpen: State['unsupportedModalOpen'];
  fileOrder: State['fileOrder'];
  tabs: State['tabs'];
  recentFilePaths: State['recentFilePaths'];
  editorHistory: State['editorHistory'];
  activeTabId: State['activeTabId'];
  expanded: State['expanded'];
  activeFolder: State['activeFolder'];
  selectedPath: State['selectedPath'];
  folderCollapsed: State['folderCollapsed'];
  sidebarCollapsed: State['sidebarCollapsed'];
  sidebarWidth: State['sidebarWidth'];
  pendingSemanticNames: State['pendingSemanticNames'];
  semanticIndexing: State['semanticIndexing'];
  pendingConversions: State['pendingConversions'];
  blockedConversions: State['blockedConversions'];
  conversionProgress: State['conversionProgress'];
  conversionRevision: State['conversionRevision'];
  conversionVersions: State['conversionVersions'];
  syncRunning: State['syncRunning'];
  embedderHasKey: State['embedderHasKey'];
  indexWarning: State['indexWarning'];
  preparationFailures: State['preparationFailures'];
  newFolderInputOpen: State['newFolderInputOpen'];
  /** Derived from `tabs` + `activeTabId` — see `getActiveTab`. */
  activeTab: Tab | null;
}

export const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ state, children }: { state: State; children: ReactNode }) {
  const value = useMemo<WorkspaceState>(() => ({
    booted: state.booted,
    folder: state.folder,
    folderPath: state.folderPath,
    recent: state.recent,
    homeDir: state.homeDir,
    libraryFolderStatuses: state.libraryFolderStatuses,
    files: state.files,
    folders: state.folders,
    unsupportedFiles: state.unsupportedFiles,
    unsupportedModalOpen: state.unsupportedModalOpen,
    fileOrder: state.fileOrder,
    tabs: state.tabs,
    recentFilePaths: state.recentFilePaths,
    editorHistory: state.editorHistory,
    activeTabId: state.activeTabId,
    expanded: state.expanded,
    activeFolder: state.activeFolder,
    selectedPath: state.selectedPath,
    folderCollapsed: state.folderCollapsed,
    sidebarCollapsed: state.sidebarCollapsed,
    sidebarWidth: state.sidebarWidth,
    pendingSemanticNames: state.pendingSemanticNames,
    semanticIndexing: state.semanticIndexing,
    pendingConversions: state.pendingConversions,
    blockedConversions: state.blockedConversions,
    conversionProgress: state.conversionProgress,
    conversionRevision: state.conversionRevision,
    conversionVersions: state.conversionVersions,
    syncRunning: state.syncRunning,
    embedderHasKey: state.embedderHasKey,
    indexWarning: state.indexWarning,
    preparationFailures: state.preparationFailures,
    newFolderInputOpen: state.newFolderInputOpen,
    activeTab: getActiveTab(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    state.booted, state.folder, state.folderPath, state.recent, state.homeDir,
    state.libraryFolderStatuses, state.files, state.folders, state.unsupportedFiles,
    state.unsupportedModalOpen, state.fileOrder, state.tabs, state.recentFilePaths,
    state.editorHistory, state.activeTabId, state.expanded, state.activeFolder,
    state.selectedPath, state.folderCollapsed, state.sidebarCollapsed, state.sidebarWidth,
    state.pendingSemanticNames, state.semanticIndexing, state.pendingConversions,
    state.blockedConversions, state.conversionProgress, state.conversionRevision,
    state.conversionVersions, state.syncRunning, state.embedderHasKey, state.indexWarning,
    state.preparationFailures, state.newFolderInputOpen,
  ]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}
