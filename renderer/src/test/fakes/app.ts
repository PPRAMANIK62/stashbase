import { vi } from 'vite-plus/test';

import type { AppDependencies } from '@/app/dependencies';
import type { GalleryPort } from '@/features/gallery/public';
import type { CaptureBridge } from '@/platform/electron/capture';

import {
  agentCatalogPort,
  agentContextPort,
  agentInstructionsApi,
  agentSessionPort,
} from './agent';
import { documentsApi } from './documents';
import { preparationControlApi, preparationStatusApi } from './preparation';
import { exactSearchApi, indexDecisionApi, semanticSearchApi } from './retrieval';
import {
  agentRuntimePort,
  appearancePort,
  capturePort,
  embedderPort,
  mcpAccessPort,
  onboardingPort,
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

/** The shop's port. The index answers null by default, so a test that does not
 *  care about the gallery still renders the bundled snapshot rather than an
 *  empty shelf. */
export function galleryPort(overrides: Partial<GalleryPort> = {}): GalleryPort {
  return {
    copy: vi.fn(async () => '/library/Copy'),
    loadIndex: vi.fn(async () => null),
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
      instructions: agentInstructionsApi(),
      session: agentSessionPort().port,
    },
    bugReport: null,
    capture: null,
    documents: documentsApi(),
    gallery: galleryPort(),
    library: { api: adapters.library, folderPicker: folderPicker(), lifecycle: adapters.lifecycle },
    preparation: { controlApi: preparationControlApi(), statusApi: preparationStatusApi() },
    retrieval: {
      decisionApi: indexDecisionApi(),
      exactSearchApi: exactSearchApi(),
      semanticSearchApi: semanticSearchApi(),
    },
    settings: {
      agentRuntimeApi: agentRuntimePort(),
      appearanceApi: appearancePort(),
      captureApi: capturePort(),
      embedderApi: embedderPort(),
      mcpAccessApi: mcpAccessPort(),
      onboardingApi: onboardingPort(),
      transcriptionApi: transcriptionPort(),
    },
    workspace: { adapters, revealLabel: 'Show in file manager' },
    ...overrides,
  };
}
