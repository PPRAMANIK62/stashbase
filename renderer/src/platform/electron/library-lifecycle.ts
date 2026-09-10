import type {
  LibraryInitialFolderResponse,
  LibraryLifecycleResponse,
  LibraryOpenFolderWindowResponse,
  LibraryPrepareFolderRemovalResponse,
} from '@/protocols/electron/library';

export interface LibraryLifecycleBridge {
  claimInitialFolder(): Promise<LibraryInitialFolderResponse>;
  notifyFolderRemoved(folderPath: string): Promise<LibraryLifecycleResponse>;
  onFolderRemoved(handler: (folderPath: string) => void): () => void;
  onPrepareFolderRemoval(handler: (folderPath: string) => boolean | Promise<boolean>): () => void;
  openFolderWindow(folderPath: string): Promise<LibraryOpenFolderWindowResponse>;
  prepareFolderRemoval(folderPath: string): Promise<LibraryPrepareFolderRemovalResponse>;
  setActiveFolder(folderPath: string | null): Promise<LibraryLifecycleResponse>;
}

/** Whether the folder reached a window, however it got there. A caller only
 *  ever needs to know that it did: focusing the window that already shows the
 *  folder is main's decision, not a failure to report. */
export async function openedFolderWindow(
  bridge: Pick<LibraryLifecycleBridge, 'openFolderWindow'> | null,
  folderPath: string,
): Promise<boolean> {
  if (!bridge) return false;
  const response = await bridge.openFolderWindow(folderPath);
  return response.ok;
}

/** The folder this window was created for, claimed once. Null means this
 *  window lands wherever it would have landed anyway: nobody named a folder
 *  for it, there is no desktop to ask, or the desktop refused. The reader's
 *  next move is the same in all three, so they are one answer rather than a
 *  refusal every caller would have to remember to sort. */
export async function claimedInitialFolder(
  bridge: Pick<LibraryLifecycleBridge, 'claimInitialFolder'> | null,
): Promise<string | null> {
  if (!bridge) return null;
  const response = await bridge.claimInitialFolder();
  return response.ok ? response.folderPath : null;
}
