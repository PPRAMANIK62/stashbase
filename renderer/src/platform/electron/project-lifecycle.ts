import type {
  ProjectEntryRequest,
  ProjectLifecycleResponse,
  ProjectOpenFolderWindowResponse,
  ProjectPrepareFolderRemovalResponse,
} from '@/protocols/electron/project';

export interface ProjectLifecycleBridge {
  onEnterFolder(handler: (request: ProjectEntryRequest) => Promise<string | null>): () => void;
  notifyFolderRemoved(folderPath: string): Promise<ProjectLifecycleResponse>;
  onFolderRemoved(handler: (folderPath: string) => void): () => void;
  onPrepareFolderRemoval(handler: (folderPath: string) => boolean | Promise<boolean>): () => void;
  cancelEntry(requestId: string): Promise<ProjectLifecycleResponse>;
  onEntryCancelled(handler: (requestId: string) => void): () => void;
  openFolderWindow(
    folderPath: string,
    requestId?: string,
  ): Promise<ProjectOpenFolderWindowResponse>;
  prepareFolderRemoval(folderPath: string): Promise<ProjectPrepareFolderRemovalResponse>;
  setActiveFolder(folderPath: string | null): Promise<ProjectLifecycleResponse>;
}
