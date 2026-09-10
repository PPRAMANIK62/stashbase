import { vi } from 'vite-plus/test';

import type { AppDependencies } from '@/app/dependencies';
import type { CaptureBridge } from '@/platform/electron/capture';

import { agentCatalogPort, agentContextPort, agentSessionPort } from './agent';
import { documentsApi } from './documents';
import { preparationControlApi, preparationStatusApi } from './preparation';
import { exactSearchApi, indexDecisionApi, semanticSearchApi } from './retrieval';
import {
  agentRuntimePort,
  capturePort,
  embedderPort,
  mcpAccessPort,
  transcriptionPort,
} from './settings';
import { folderPicker, workspaceAdapters } from './workspace';

/** The desktop clipboard bridge. `appDependencies` leaves `capture` null, as
 *  it is outside Electron; a test that exercises the import offer passes this. */
export function captureBridge(overrides: Partial<CaptureBridge> = {}): CaptureBridge {
  return {
    markCurrentImageHandled: vi.fn(),
    markHandled: vi.fn(),
    onImageAvailable: vi.fn(() => () => undefined),
    refreshWatch: vi.fn(async () => true),
    setComposerFocused: vi.fn(),
    ...overrides,
  };
}

/** The whole dependency graph the shell is composed from. Every port is a
 *  `vi.fn`, so a test asserts on calls without building the rest. Override
 *  one slice at a time; each slice is complete on its own. */
export function appDependencies(overrides: Partial<AppDependencies> = {}): AppDependencies {
  const adapters = overrides.workspace?.adapters ?? workspaceAdapters();
  return {
    agent: {
      catalog: agentCatalogPort(),
      context: agentContextPort(),
      session: agentSessionPort().port,
    },
    bugReport: null,
    capture: null,
    documents: documentsApi(),
    library: { api: adapters.library, folderPicker: folderPicker(), lifecycle: adapters.lifecycle },
    preparation: { controlApi: preparationControlApi(), statusApi: preparationStatusApi() },
    retrieval: {
      decisionApi: indexDecisionApi(),
      exactSearchApi: exactSearchApi(),
      semanticSearchApi: semanticSearchApi(),
    },
    settings: {
      agentRuntimeApi: agentRuntimePort(),
      captureApi: capturePort(),
      embedderApi: embedderPort(),
      mcpAccessApi: mcpAccessPort(),
      transcriptionApi: transcriptionPort(),
    },
    workspace: { adapters, revealLabel: 'Show in file manager' },
    ...overrides,
  };
}
