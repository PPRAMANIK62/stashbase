import type {
  LibraryLifecycleResponse,
  LibraryPrepareFolderRemovalResponse,
} from '@/protocols/electron/library';

export interface LibraryLifecycleBridge {
  notifyFolderRemoved(folderPath: string): Promise<LibraryLifecycleResponse>;
  onFolderRemoved(handler: (folderPath: string) => void): () => void;
  onPrepareFolderRemoval(handler: (folderPath: string) => boolean | Promise<boolean>): () => void;
  prepareFolderRemoval(folderPath: string): Promise<LibraryPrepareFolderRemovalResponse>;
  setActiveFolder(folderPath: string | null): Promise<LibraryLifecycleResponse>;
}
