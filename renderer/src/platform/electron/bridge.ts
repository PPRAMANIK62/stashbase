import {
  type RendererRuntimeConfig,
  rendererRuntimeConfigSchema,
} from '@/protocols/electron/runtime';

import { isBugReportBridge, type BugReportBridge } from './bug-report';
import { isCaptureBridge, type CaptureBridge } from './capture';
import type { ExternalNavigationBridge } from './external-navigation';
import type { LibraryBridge } from './folder-picker';
import type { LibraryLifecycleBridge } from './library-lifecycle';
import { isUpdatesBridge, type UpdatesBridge } from './updates';
import type { WindowLifecycleBridge } from './window-lifecycle';

interface DesktopWorkspaceSessionBridge {
  read(): Promise<unknown>;
  write(snapshot: unknown): Promise<unknown>;
}

interface DesktopLibraryBridge extends LibraryBridge, LibraryLifecycleBridge {}

interface DesktopBridge {
  /** Optional: opening the bug-report review exists only in the desktop shell. */
  bugReport?: BugReportBridge;
  /** Optional: clipboard-image offers exist only in the desktop shell. */
  capture?: CaptureBridge;
  externalNavigation: ExternalNavigationBridge;
  library: DesktopLibraryBridge;
  runtime: RendererRuntimeConfig;
  /** Optional: keeping this build current exists only in the desktop shell. */
  updates?: UpdatesBridge;
  workspaceSession: DesktopWorkspaceSessionBridge;
  windowLifecycle: WindowLifecycleBridge;
}

declare global {
  interface Window {
    stashbase?: {
      bugReport?: unknown;
      bugReportReview?: unknown;
      capture?: unknown;
      externalNavigation?: ExternalNavigationBridge;
      library?: DesktopLibraryBridge;
      runtime?: unknown;
      updates?: unknown;
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
    typeof library.claimInitialFolder !== 'function' ||
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
  const bugReport = globalWindow.stashbase?.bugReport;
  const capture = globalWindow.stashbase?.capture;
  const updates = globalWindow.stashbase?.updates;
  return {
    ...(isBugReportBridge(bugReport) ? { bugReport } : {}),
    ...(isCaptureBridge(capture) ? { capture } : {}),
    ...(isUpdatesBridge(updates) ? { updates } : {}),
    externalNavigation,
    library,
    runtime,
    windowLifecycle,
    workspaceSession,
  };
}
