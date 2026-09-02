export { useWorkspace } from './hooks/use-workspace';
export { useLibraryLifecycle } from './hooks/use-library-lifecycle';
export { usePersistWorkspaceSession, useWorkspaceSession } from './hooks/use-workspace-session';
export { createWorkspaceRuntime, type WorkspaceRuntime } from './application/runtime';
export {
  createWorkspaceSessionRuntime,
  type WorkspaceSessionRuntime,
} from './application/session-runtime';
export type { FolderSessionState, WorkspaceDocumentSession } from './domain/session';
export type { WorkspaceScope } from './domain/workspace';
export { createFilesApi } from './infrastructure/files-api';
export { createLibraryApi } from './infrastructure/api';
export { createLibraryLifecycle } from './infrastructure/library-lifecycle';
export { createWorkspaceSessionPersistence } from './infrastructure/session-persistence';
export { FileTree, type FileTreeProps } from './ui/file-tree';
export { LibrarySidebar, type LibrarySidebarProps } from './ui/sidebar';
export { LibraryWelcome, type LibraryWelcomeProps } from './ui/welcome';
