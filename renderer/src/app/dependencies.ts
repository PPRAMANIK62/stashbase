import {
  createFilesApi,
  createLibraryApi,
  type FileTreeProps,
  type LibrarySidebarProps,
  type LibraryWelcomeProps,
} from '@/features/workspace/public';
import { readBridge } from '@/platform/electron/bridge';
import { fileManagerLabel } from '@/platform/electron/file-manager';
import { createFolderPicker } from '@/platform/electron/folder-picker';
import { createHttpClient } from '@/platform/http/client';

export interface AppDependencies {
  library: LibrarySidebarProps & LibraryWelcomeProps;
  workspace: Omit<FileTreeProps, 'runtime'>;
}

export function createDependencies(): AppDependencies {
  const bridge = readBridge();
  const http = createHttpClient(bridge.runtime.serverOrigin);
  return {
    library: {
      api: createLibraryApi(http),
      folderPicker: createFolderPicker(bridge.library),
    },
    workspace: {
      api: createFilesApi(http),
      revealLabel: fileManagerLabel(),
    },
  };
}
