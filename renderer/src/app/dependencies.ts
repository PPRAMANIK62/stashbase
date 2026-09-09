import {
  createAgentContextApi,
  createAgentSessionApi,
  type AgentContextPort,
  type AgentSessionPort,
} from '@/features/agent/public';
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
import {
  createPreparationControlApi,
  createPreparationStatusApi,
  type PreparationControlApi,
  type PreparationStatusApi,
} from '@/features/preparation/public';
import {
  createExactSearchApi,
  createIndexDecisionApi,
  createSemanticSearchApi,
  type ExactSearchApi,
  type IndexDecisionApi,
  type SemanticSearchApi,
} from '@/features/retrieval/public';
import {
  createAgentRuntimeApi,
  createCaptureApi,
  createEmbedderApi,
  createTranscriptionApi,
  type AgentRuntimePort,
  type CapturePort,
  type EmbedderPort,
  type TranscriptionPort,
} from '@/features/settings/public';
import {
  createFilesApi,
  createLibraryApi,
  createLibraryLifecycle,
  createUploadApi,
  createWorkspaceSessionPersistence,
  type FileTreeProps,
  type LibrarySidebarProps,
  type LibraryWelcomeProps,
  type UploadApi,
} from '@/features/workspace/public';
import { readBridge } from '@/platform/electron/bridge';
import type { CaptureBridge } from '@/platform/electron/capture';
import { createExternalNavigation } from '@/platform/electron/external-navigation';
import { fileManagerLabel } from '@/platform/electron/file-manager';
import { createFolderPicker } from '@/platform/electron/folder-picker';
import { createHttpClient } from '@/platform/http/client';

export interface AppDependencies {
  agent: {
    context: AgentContextPort;
    session: AgentSessionPort;
  };
  /** Desktop clipboard capture; null outside Electron or when the capability is absent. */
  capture: CaptureBridge | null;
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
  preparation: {
    controlApi: PreparationControlApi;
    statusApi: PreparationStatusApi;
  };
  retrieval: {
    decisionApi: IndexDecisionApi;
    exactSearchApi: ExactSearchApi;
    semanticSearchApi: SemanticSearchApi;
  };
  session: ReturnType<typeof createWorkspaceSessionPersistence>;
  settings: {
    agentRuntimeApi: AgentRuntimePort;
    captureApi: CapturePort;
    embedderApi: EmbedderPort;
    transcriptionApi: TranscriptionPort;
  };
  workspace: Omit<
    FileTreeProps,
    'runtime' | 'onOpenSource' | 'onReprocess' | 'onScopeLost' | 'rowMarkers'
  > & {
    uploadApi: UploadApi;
  };
}

export function createDependencies(): AppDependencies {
  const bridge = readBridge();
  const http = createHttpClient(bridge.runtime.serverOrigin);
  const externalNavigation = createExternalNavigation(bridge.externalNavigation);
  return {
    agent: {
      context: createAgentContextApi(http, bridge.runtime.serverOrigin),
      session: createAgentSessionApi(http, bridge.runtime.serverOrigin),
    },
    capture: bridge.capture ?? null,
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
    preparation: {
      controlApi: createPreparationControlApi(http),
      statusApi: createPreparationStatusApi(http),
    },
    retrieval: {
      decisionApi: createIndexDecisionApi(http),
      exactSearchApi: createExactSearchApi(http),
      semanticSearchApi: createSemanticSearchApi(http),
    },
    session: createWorkspaceSessionPersistence(bridge.workspaceSession),
    settings: {
      agentRuntimeApi: createAgentRuntimeApi(http),
      captureApi: createCaptureApi(http),
      embedderApi: createEmbedderApi(http),
      transcriptionApi: createTranscriptionApi(http),
    },
    workspace: {
      api: createFilesApi(http),
      revealLabel: fileManagerLabel(),
      uploadApi: createUploadApi(bridge.runtime.serverOrigin),
    },
  };
}
