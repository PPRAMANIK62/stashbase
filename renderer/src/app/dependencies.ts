import {
  createDocumentAssetApi,
  createDocumentSourceApi,
  createDocumentWindowLifecycle,
  createGenericFilePreviewApi,
  type DocumentAssetApi,
  type DocumentSourceApi,
  type DocumentWindowLifecycle,
  type GenericFilePreviewApi,
} from '@/features/documents/public';
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
import { createExternalNavigation } from '@/platform/electron/external-navigation';
import { fileManagerLabel } from '@/platform/electron/file-manager';
import { createFolderPicker } from '@/platform/electron/folder-picker';
import { createHttpClient } from '@/platform/http/client';

export interface AppDependencies {
  documents: {
    assetApi: DocumentAssetApi;
    sourceApi: DocumentSourceApi;
    createId: () => string;
    genericPreviewApi: GenericFilePreviewApi;
    lifecycle: DocumentWindowLifecycle;
    openExternal(href: string): Promise<boolean>;
  };
  library: LibrarySidebarProps & LibraryWelcomeProps;
  session: ReturnType<typeof createWorkspaceSessionPersistence>;
  workspace: Omit<FileTreeProps, 'runtime'>;
}

export function createDependencies(): AppDependencies {
  const bridge = readBridge();
  const http = createHttpClient(bridge.runtime.serverOrigin);
  const externalNavigation = createExternalNavigation(bridge.externalNavigation);
  return {
    documents: {
      assetApi: createDocumentAssetApi(http, bridge.runtime.serverOrigin),
      sourceApi: createDocumentSourceApi(http),
      createId: () => globalThis.crypto.randomUUID(),
      genericPreviewApi: createGenericFilePreviewApi(http),
      lifecycle: createDocumentWindowLifecycle(bridge.windowLifecycle),
      openExternal: externalNavigation.open,
    },
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
