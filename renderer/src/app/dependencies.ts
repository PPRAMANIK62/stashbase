import {
  createFilesApi,
  createLibraryApi,
  createLibraryLifecycle,
  createWorkspaceSessionPersistence,
  type FileTreeProps,
  type LibrarySidebarProps,
  type LibraryWelcomeProps,
} from '@/features/workspace/public';
import { readBridge } from '@/platform/electron/bridge';
import { fileManagerLabel } from '@/platform/electron/file-manager';
import { createFolderPicker } from '@/platform/electron/folder-picker';
import { createHttpClient } from '@/platform/http/client';

export interface AppDependencies {
  documents: { createId: () => string };
  library: LibrarySidebarProps & LibraryWelcomeProps;
  session: ReturnType<typeof createWorkspaceSessionPersistence>;
  workspace: Omit<FileTreeProps, 'runtime'>;
}

export function createDependencies(): AppDependencies {
  const bridge = readBridge();
  const http = createHttpClient(bridge.runtime.serverOrigin);
  return {
    documents: { createId: () => globalThis.crypto.randomUUID() },
    library: {
      api: createLibraryApi(http),
      folderPicker: createFolderPicker(bridge.library),
      lifecycle: createLibraryLifecycle(bridge.library),
    },
    session: createWorkspaceSessionPersistence(bridge.workspaceSession),
    workspace: {
      api: createFilesApi(http),
      revealLabel: fileManagerLabel(),
    },
  };
}
