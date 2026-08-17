/**
 * Public surface of the Workspace feature — the folder/tab/library
 * chrome the shell lays out around a document.
 *
 * `workspace.css` rides the barrel because every surface below is styled
 * by it and none of them is optional; importing the barrel is what puts
 * the stylesheet in the graph, so no consumer has to remember it.
 *
 * Everything here is eager on purpose: each surface is either always
 * mounted (splitters, folder switcher) or mounted as soon as the window
 * has a folder or a tab, so a lazy boundary would only add a flash.
 */
import './workspace.css';

export { EmptyTabLanding } from '@/features/workspace/components/EmptyTabLanding';
export { FileTree } from '@/features/workspace/components/FileTree';
export { FolderMenu } from '@/features/workspace/components/FolderMenu';
export { FolderSwitcher } from '@/features/workspace/components/FolderSwitcher';
export { RemoveFolderModal } from '@/features/workspace/components/RemoveFolderModal';
export { TabStrip } from '@/features/workspace/components/TabStrip';
export { ChatSplitter, SidebarSplitter } from '@/features/workspace/components/WorkspaceSplitters';

export { useFolderRemoval } from '@/features/workspace/hooks/useFolderRemoval';
export { useGlobalDragDrop } from '@/features/workspace/hooks/useGlobalDragDrop';
export { useLibraryReconcile } from '@/features/workspace/hooks/useLibraryReconcile';

/** Imperative membership resync — see `lib/libraryMembership.ts`. It is a
 *  plain async function rather than a hook, so it is exported from the
 *  module that owns it instead of from the poll hook that also calls it. */
export { refreshLibraryMembership } from '@/features/workspace/lib/libraryMembership';
