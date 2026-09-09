export { useWorkspace } from './hooks/use-workspace';
export { useFiles } from './hooks/use-files';
export { useLibrary } from './hooks/use-library';
export { useLibraryLifecycle } from './hooks/use-library-lifecycle';
export { usePersistWorkspaceSession, useWorkspaceSession } from './hooks/use-workspace-session';
export { useReveal } from './hooks/use-reveal';
export type { FilesApi, UploadApi, UploadFile, UploadOutcome } from './application/ports';
export { workspaceQueryKeys } from './application/queries';
export { createWorkspaceRuntime, type WorkspaceRuntime } from './application/runtime';
export {
  createWorkspaceSessionRuntime,
  type WorkspaceSessionRuntime,
} from './application/session-runtime';
export {
  DEFAULT_AGENT_PANE_WIDTH,
  MAX_AGENT_PANE_WIDTH,
  MIN_AGENT_PANE_WIDTH,
  type FolderSessionState,
  type WorkspaceDocumentSession,
} from './domain/session';
export type { WorkspaceScope } from './domain/workspace';
export { displayFolderPath, folderName } from './domain/library';
export { fileIsRestricted, type WorkspaceFile, type WorkspaceListing } from './domain/tree';
export { createFilesApi } from './infrastructure/files-api';
export { createUploadApi } from './infrastructure/upload-api';
export { createLibraryApi } from './infrastructure/api';
export { createLibraryLifecycle } from './infrastructure/library-lifecycle';
export { createWorkspaceSessionPersistence } from './infrastructure/session-persistence';
export { FileTree, type FileTreeProps, type FileTreeRowMarker } from './ui/file-tree';
export { LibrarySidebar, type LibrarySidebarProps } from './ui/sidebar';
export { LibraryWelcome, type LibraryWelcomeProps } from './ui/welcome';
