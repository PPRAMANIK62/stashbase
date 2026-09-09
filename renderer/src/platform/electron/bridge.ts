import {
  type RendererRuntimeConfig,
  rendererRuntimeConfigSchema,
} from '@/protocols/electron/runtime';

import { isCaptureBridge, type CaptureBridge } from './capture';
import type { ExternalNavigationBridge } from './external-navigation';
import type { LibraryBridge } from './folder-picker';
import type { LibraryLifecycleBridge } from './library-lifecycle';
import type { WindowLifecycleBridge } from './window-lifecycle';

interface DesktopWorkspaceSessionBridge {
  read(): Promise<unknown>;
  write(snapshot: unknown): Promise<unknown>;
}

interface DesktopLibraryBridge extends LibraryBridge, LibraryLifecycleBridge {}

interface DesktopBridge {
  /** Optional: clipboard-image offers exist only in the desktop shell. */
  capture?: CaptureBridge;
  externalNavigation: ExternalNavigationBridge;
  library: DesktopLibraryBridge;
  runtime: RendererRuntimeConfig;
  workspaceSession: DesktopWorkspaceSessionBridge;
  windowLifecycle: WindowLifecycleBridge;
}

declare global {
  interface Window {
    stashbase?: {
      capture?: unknown;
      externalNavigation?: ExternalNavigationBridge;
      library?: DesktopLibraryBridge;
      runtime?: unknown;
      workspaceSession?: DesktopWorkspaceSessionBridge;
      windowLifecycle?: WindowLifecycleBridge;
    };
  }
}

export function readBridge(globalWindow: Window = window): DesktopBridge {
  const runtime = rendererRuntimeConfigSchema.parse(globalWindow.stashbase?.runtime);
  const externalNavigation = globalWindow.stashbase?.externalNavigation;
  const library = globalWindow.stashbase?.library;
  const workspaceSession = globalWindow.stashbase?.workspaceSession;
  const windowLifecycle = globalWindow.stashbase?.windowLifecycle;
  if (!externalNavigation || typeof externalNavigation.open !== 'function') {
    throw new Error('External navigation is unavailable.');
  }
  if (
    !library ||
    typeof library.chooseFolder !== 'function' ||
    typeof library.notifyFolderRemoved !== 'function' ||
    typeof library.onFolderRemoved !== 'function' ||
    typeof library.onPrepareFolderRemoval !== 'function' ||
    typeof library.prepareFolderRemoval !== 'function' ||
    typeof library.setActiveFolder !== 'function'
  ) {
    throw new Error('The library folder picker is unavailable.');
  }
  if (
    !workspaceSession ||
    typeof workspaceSession.read !== 'function' ||
    typeof workspaceSession.write !== 'function'
  ) {
    throw new Error('Workspace session persistence is unavailable.');
  }
  if (
    !windowLifecycle ||
    typeof windowLifecycle.onPrepareContextRelease !== 'function' ||
    typeof windowLifecycle.reload !== 'function'
  ) {
    throw new Error('The window lifecycle is unavailable.');
  }
  const capture = globalWindow.stashbase?.capture;
  return {
    ...(isCaptureBridge(capture) ? { capture } : {}),
    externalNavigation,
    library,
    runtime,
    windowLifecycle,
    workspaceSession,
  };
}
