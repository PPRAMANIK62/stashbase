/**
 * Everything the workspace window is built from, resolved once at startup.
 *
 * The app names one adapter record per feature and nothing below it: which
 * port sits on HTTP, which on a desktop bridge, and how many of them there are
 * is each feature's own business, so a feature that gains a transport does not
 * change this file. What stays here is the wiring a feature cannot do for
 * itself — the bridges and the server origin it is handed — and the few
 * capabilities that belong to the desktop shell rather than to any feature.
 */
import type { ComponentProps } from 'react';

import {
  createAgentCatalogAdapter,
  createAgentInstructionsAdapter,
  createAgentContextAdapter,
  createAgentSessionAdapter,
  type AgentCatalogPort,
  type AgentInstructionsPort,
  type AgentContextPort,
  type AgentSessionPort,
} from '@/features/agent/public';
import { createDocumentAdapters, type DocumentAdapters } from '@/features/documents/public';
import { createGalleryIndexAdapter, type GalleryPort } from '@/features/gallery/public';
import {
  createPreparationControlAdapter,
  createPreparationStatusAdapter,
  type PreparationControlPort,
  type PreparationStatusPort,
} from '@/features/preparation/public';
import {
  createExactSearchAdapter,
  createIndexDecisionAdapter,
  createSemanticSearchAdapter,
  type ExactSearchPort,
  type IndexDecisionPort,
  type SemanticSearchPort,
} from '@/features/retrieval/public';
import {
  createAgentRuntimeAdapter,
  createCaptureAdapter,
  createEmbedderAdapter,
  createMcpAccessAdapter,
  createOnboardingAdapter,
  createTranscriptionAdapter,
  type AgentRuntimePort,
  type CapturePort,
  type EmbedderPort,
  type McpAccessPort,
  type OnboardingPort,
  type TranscriptionPort,
} from '@/features/settings/public';
import {
  createWorkspaceAdapters,
  FileTree,
  LibrarySidebar,
  LibraryWelcome,
  type WorkspaceAdapters,
} from '@/features/workspace/public';
import { readBridge } from '@/platform/electron/bridge';
import type { BugReportBridge } from '@/platform/electron/bug-report';
import type { CaptureBridge } from '@/platform/electron/capture';
import { createExternalNavigation } from '@/platform/electron/external-navigation';
import { fileManagerLabel } from '@/platform/electron/file-manager';
import { createFolderPicker } from '@/platform/electron/folder-picker';
import { openedFolderWindow } from '@/platform/electron/library-lifecycle';
import { createHttpClient } from '@/platform/http/client';

/** The folder chrome's dependencies, as the two components declare them. */
type LibraryChrome = Pick<
  ComponentProps<typeof LibrarySidebar> & ComponentProps<typeof LibraryWelcome>,
  'api' | 'folderPicker' | 'lifecycle'
>;

export interface AppDependencies {
  agent: {
    /** Which runtimes a conversation can open on. Settings reads the same
     *  endpoint through its own port for its own question. */
    catalog: AgentCatalogPort;
    context: AgentContextPort;
    instructions: AgentInstructionsPort;
    session: AgentSessionPort;
  };
  /** Opens the bug-report review for this window; null outside Electron. */
  bugReport: BugReportBridge | null;
  /** Desktop clipboard capture; null outside Electron or when the capability is absent. */
  capture: CaptureBridge | null;
  documents: {
    adapters: DocumentAdapters;
    createId: () => string;
    openExternal(href: string): Promise<boolean>;
  };
  /** The shop, and the whole take-this-copy action it does not own itself. */
  gallery: GalleryPort;
  library: LibraryChrome;
  preparation: {
    controlApi: PreparationControlPort;
    statusApi: PreparationStatusPort;
  };
  retrieval: {
    decisionApi: IndexDecisionPort;
    exactSearchApi: ExactSearchPort;
    semanticSearchApi: SemanticSearchPort;
  };
  settings: {
    agentRuntimeApi: AgentRuntimePort;
    captureApi: CapturePort;
    embedderApi: EmbedderPort;
    mcpAccessApi: McpAccessPort;
    onboardingApi: OnboardingPort;
    transcriptionApi: TranscriptionPort;
  };
  workspace: {
    adapters: WorkspaceAdapters;
    /** What this platform calls the app that reveals a file. */
    revealLabel: ComponentProps<typeof FileTree>['revealLabel'];
  };
}

export function createDependencies(): AppDependencies {
  const bridge = readBridge();
  const http = createHttpClient(bridge.runtime.serverOrigin);
  const externalNavigation = createExternalNavigation(bridge.externalNavigation);
  const workspace = createWorkspaceAdapters({
    capture: bridge.capture ?? null,
    http,
    library: bridge.library,
    serverOrigin: bridge.runtime.serverOrigin,
    workspaceSession: bridge.workspaceSession,
  });
  return {
    agent: {
      catalog: createAgentCatalogAdapter(http),
      instructions: createAgentInstructionsAdapter(http),
      context: createAgentContextAdapter(http, bridge.runtime.serverOrigin),
      session: createAgentSessionAdapter(http, bridge.runtime.serverOrigin),
    },
    bugReport: bridge.bugReport ?? null,
    capture: bridge.capture ?? null,
    documents: {
      adapters: createDocumentAdapters({
        http,
        serverOrigin: bridge.runtime.serverOrigin,
        windowLifecycle: bridge.windowLifecycle,
      }),
      createId: () => globalThis.crypto.randomUUID(),
      openExternal: externalNavigation.open,
    },
    gallery: {
      // Taking a copy is the Library's ordinary public import into folder
      // home, then a window of its own. Neither is the shop's to own: the
      // destination and the name rules belong to the Library, and the window
      // belongs to the desktop. A copy the Library made but no window could
      // show is still a folder in the switcher, so it says exactly that
      // rather than implying nothing happened.
      async copy(request, signal) {
        // The entry's own name when the Library's rule accepts it, since that
        // is what the reader just read on the card; the repository's derived
        // name otherwise.
        const derived = workspace.githubImport.readUrl(request.repo);
        const folderName = workspace.githubImport.readFolderName(request.name)
          ?? (derived.ok ? derived.folderName : request.name);
        const path = await workspace.githubImport.run(request.repo, folderName, signal);
        if (!(await openedFolderWindow(bridge.library, path))) {
          throw new Error('the copy was made but no window could open it');
        }
        return path;
      },
      ...createGalleryIndexAdapter(http),
    },
    library: {
      api: workspace.library,
      folderPicker: createFolderPicker(bridge.library),
      lifecycle: workspace.lifecycle,
    },
    preparation: {
      controlApi: createPreparationControlAdapter(http),
      statusApi: createPreparationStatusAdapter(http),
    },
    retrieval: {
      decisionApi: createIndexDecisionAdapter(http),
      exactSearchApi: createExactSearchAdapter(http),
      semanticSearchApi: createSemanticSearchAdapter(http),
    },
    settings: {
      agentRuntimeApi: createAgentRuntimeAdapter(http),
      captureApi: createCaptureAdapter(http),
      embedderApi: createEmbedderAdapter(http),
      mcpAccessApi: createMcpAccessAdapter(http),
      onboardingApi: createOnboardingAdapter(http),
      transcriptionApi: createTranscriptionAdapter(http),
    },
    workspace: { adapters: workspace, revealLabel: fileManagerLabel() },
  };
}
