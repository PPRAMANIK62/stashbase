/**
 * The Workspace feature's whole surface to `renderer/src/app`.
 *
 * The feature answers for its own transports through `createWorkspaceAdapters`,
 * so nothing here names an HTTP client or a desktop bridge, and a feature that
 * moves a port between HTTP and the desktop bridge does not change the app.
 * Everything named here has a caller in the running app; what only a test
 * builds lives in `test-support.ts`.
 */
export { useWorkspace } from './hooks/use-workspace';
export { useFiles } from './hooks/use-files';
export { useLibrary } from './hooks/use-library';
export { useLibraryLifecycle } from './hooks/use-library-lifecycle';
export {
  useWorkspaceSession,
  type WorkspaceSessionController,
} from './hooks/use-workspace-session';
export { useReveal } from './hooks/use-reveal';
export { refreshFolderListing } from './application/queries';
export type { WorkspaceOperationScope, WorkspaceRuntime } from './application/runtime';
export { AGENT_PANE_WIDTH } from './domain/session';
export {
  fileIsRestricted,
  treePathWithin,
  type WorkspaceEntry,
  type WorkspaceListing,
} from './domain/tree';
export type { ActiveLibraryFolder, LibrarySnapshot } from './domain/library';
export type { WorkspaceScope } from './domain/workspace';
export { createWorkspaceAdapters, type WorkspaceAdapters } from './infrastructure/adapters';
export { ClipboardOffer } from './ui/clipboard-offer';
export { FileTree, type FileTreeRowMarker } from './ui/file-tree';
export { LibrarySidebar } from './ui/sidebar';
export { LibraryWelcome } from './ui/welcome';
