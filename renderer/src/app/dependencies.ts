import {
  createDocumentAssetApi,
  createDocxPreviewApi,
  createDocumentSourceApi,
  createDocumentWindowLifecycle,
  createGenericFilePreviewApi,
  createMediaApi,
  type DocumentAssetApi,
  type DocumentSourceApi,
  type DocumentWindowLifecycle,
  type DocxPreviewApi,
  type GenericFilePreviewApi,
  type MediaApi,
} from '@/features/documents/public';
import { createExactSearchApi, type ExactSearchApi } from '@/features/retrieval/public';
import { createAgentRuntimeApi, type AgentRuntimePort } from '@/features/settings/public';
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
    docxPreviewApi: DocxPreviewApi;
    sourceApi: DocumentSourceApi;
    createId: () => string;
    genericPreviewApi: GenericFilePreviewApi;
    lifecycle: DocumentWindowLifecycle;
    mediaApi: MediaApi;
    openExternal(href: string): Promise<boolean>;
  };
  library: LibrarySidebarProps & LibraryWelcomeProps;
  retrieval: {
    exactSearchApi: ExactSearchApi;
  };
  session: ReturnType<typeof createWorkspaceSessionPersistence>;
  settings: {
    agentRuntimeApi: AgentRuntimePort;
  };
  workspace: Omit<FileTreeProps, 'runtime'>;
}

export function createDependencies(): AppDependencies {
  const bridge = readBridge();
  const http = createHttpClient(bridge.runtime.serverOrigin);
  const externalNavigation = createExternalNavigation(bridge.externalNavigation);
  return {
    documents: {
      assetApi: createDocumentAssetApi(http, bridge.runtime.serverOrigin),
      docxPreviewApi: createDocxPreviewApi(),
      sourceApi: createDocumentSourceApi(http),
      createId: () => globalThis.crypto.randomUUID(),
      genericPreviewApi: createGenericFilePreviewApi(http),
      lifecycle: createDocumentWindowLifecycle(bridge.windowLifecycle),
      mediaApi: createMediaApi(http),
      openExternal: externalNavigation.open,
    },
    library: {
      api: createLibraryApi(http),
      folderPicker: createFolderPicker(bridge.library),
      lifecycle: createLibraryLifecycle(bridge.library),
    },
    retrieval: {
      exactSearchApi: createExactSearchApi(http),
    },
    session: createWorkspaceSessionPersistence(bridge.workspaceSession),
    settings: {
      agentRuntimeApi: createAgentRuntimeApi(http),
    },
    workspace: {
      api: createFilesApi(http),
      revealLabel: fileManagerLabel(),
    },
  };
}
