import type {
  LibraryLifecycleResponse,
  LibraryOpenFolderWindowResponse,
  LibraryPrepareFolderRemovalResponse,
} from '@/protocols/electron/library';

export interface LibraryLifecycleBridge {
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
