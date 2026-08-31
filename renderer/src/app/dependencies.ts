import {
  createLibraryApi,
  type LibrarySidebarProps,
  type LibraryWelcomeProps,
} from '@/features/workspace/public';
import { readBridge } from '@/platform/electron/bridge';
import { createFolderPicker } from '@/platform/electron/folder-picker';
import { createHttpClient } from '@/platform/http/client';

export interface AppDependencies {
  library: LibrarySidebarProps & LibraryWelcomeProps;
}

export function createDependencies(): AppDependencies {
  const bridge = readBridge();
  return {
    library: {
      api: createLibraryApi(createHttpClient(bridge.runtime.serverOrigin)),
      folderPicker: createFolderPicker(bridge.library),
    },
  };
}
