import crypto from 'node:crypto';
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';

import {
  LIBRARY_FOLDER_REMOVAL_READY_CHANNEL,
  LIBRARY_FOLDER_REMOVAL_REQUESTED_CHANNEL,
  LIBRARY_FOLDER_REMOVED_CHANNEL,
  LIBRARY_LIFECYCLE_CAPABILITY,
  LIBRARY_NOTIFY_FOLDER_REMOVED_CHANNEL,
  LIBRARY_OPEN_FOLDER_WINDOW_CHANNEL,
  LIBRARY_PREPARE_FOLDER_REMOVAL_CHANNEL,
  LIBRARY_SET_ACTIVE_FOLDER_CHANNEL,
  type LibraryFolderDialogFailure,
  libraryFolderPathRequestSchema,
  libraryFolderRemovalReadySchema,
  libraryLifecycleResponseSchema,
  libraryOpenFolderWindowResponseSchema,
  libraryPrepareFolderRemovalResponseSchema,
  librarySetActiveFolderRequestSchema,
} from '../../shared/protocols/electron/library.ts';
import { authorizeSender, type SenderAuthorization } from './dialog.ts';

export { LIBRARY_LIFECYCLE_CAPABILITY };

interface WindowWebContents {
  id: number;
  isDestroyed(): boolean;
  send(channel: string, payload: unknown): void;
}

type LifecycleWindow = BrowserWindow & { webContents: WindowWebContents };

export interface LifecycleDependencies extends SenderAuthorization {
  ipcMain: Pick<IpcMain, 'handle'>;
  liveWindows(): LifecycleWindow[];
  /** Shows a member in a window of its own, or focuses the one already
   *  showing it. Main owns which of the two happens; null means neither
   *  could. The sender is passed so main can exclude it from the match — a
   *  window asking for a folder means a second window, not itself. */
  openFolderWindow(
    window: BrowserWindow,
    folderPath: string,
  ): Promise<'opened' | 'focused' | null>;
  setActiveFolder(window: BrowserWindow, folderPath: string | null): boolean;
  windowsForFolder(folderPath: string): LifecycleWindow[];
}

const failure = (
  kind: LibraryFolderDialogFailure['failure']['kind'],
  message: string,
): LibraryFolderDialogFailure => ({ ok: false, failure: { kind, message } });

export function createFolderRemovalCoordinator({
  createRequestId = () => crypto.randomUUID(),
  timeoutMs = 5_000,
}: {
  createRequestId?: () => string;
  timeoutMs?: number;
} = {}) {
  const pendingByWebContents = new Map<
    number,
    {
      folderPath: string;
      promise: Promise<boolean>;
      requestId: string;
      resolve: (ready: boolean) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  const settle = (webContentsId: number, ready: boolean) => {
    const pending = pendingByWebContents.get(webContentsId);
    if (!pending) return false;
    pendingByWebContents.delete(webContentsId);
    clearTimeout(pending.timer);
    pending.resolve(ready);
    return true;
  };

  return {
    request(window: LifecycleWindow, folderPath: string): Promise<boolean> {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return Promise.resolve(true);
      const webContentsId = window.webContents.id;
      const existing = pendingByWebContents.get(webContentsId);
      if (existing)
        return existing.folderPath === folderPath ? existing.promise : Promise.resolve(false);

      const requestId = createRequestId();
      let resolve!: (ready: boolean) => void;
      const promise = new Promise<boolean>((done) => {
        resolve = done;
      });
      const timer = setTimeout(() => settle(webContentsId, false), timeoutMs);
      timer.unref?.();
      pendingByWebContents.set(webContentsId, {
        folderPath,
        promise,
        requestId,
        resolve,
        timer,
      });
      window.webContents.send(LIBRARY_FOLDER_REMOVAL_REQUESTED_CHANNEL, { folderPath, requestId });
      return promise;
    },
    settle(webContentsId: number, payload: unknown): boolean {
      const response = libraryFolderRemovalReadySchema.safeParse(payload);
      const pending = pendingByWebContents.get(webContentsId);
      if (
        !response.success ||
        !pending ||
        pending.requestId !== response.data.requestId ||
        pending.folderPath !== response.data.folderPath
      ) {
        return false;
      }
      return settle(webContentsId, response.data.ready);
    },
  };
}

export function registerLifecycle(dependencies: LifecycleDependencies): void {
  const coordinator = createFolderRemovalCoordinator();

  dependencies.ipcMain.handle(LIBRARY_SET_ACTIVE_FOLDER_CHANNEL, (event, rawRequest) => {
    const senderWindow = authorizeSender(event, dependencies, LIBRARY_LIFECYCLE_CAPABILITY);
    if (!senderWindow) {
      return failure('unauthorized', 'This window cannot update its folder lifecycle.');
    }
    const request = librarySetActiveFolderRequestSchema.safeParse(rawRequest);
    if (!request.success) {
      return failure('invalid-response', 'The active folder request was invalid.');
    }
    if (!dependencies.setActiveFolder(senderWindow, request.data.folderPath)) {
      return failure('unavailable', 'The window folder lifecycle is unavailable.');
    }
    return libraryLifecycleResponseSchema.parse({ ok: true });
  });

  dependencies.ipcMain.handle(LIBRARY_OPEN_FOLDER_WINDOW_CHANNEL, async (event, rawRequest) => {
    const senderWindow = authorizeSender(event, dependencies, LIBRARY_LIFECYCLE_CAPABILITY);
    if (!senderWindow) {
      return failure('unauthorized', 'This window cannot open another window.');
    }
    const request = libraryFolderPathRequestSchema.safeParse(rawRequest);
    if (!request.success) {
      return failure('invalid-response', 'The folder window request was invalid.');
    }
    // The path is a folder path the schema accepted, not a membership claim.
    // Main decides whether it can be shown, exactly as it does for every other
    // way a folder reaches a window.
    const action = await dependencies.openFolderWindow(senderWindow, request.data.folderPath);
    if (!action) return failure('unavailable', 'That folder could not be opened in a window.');
    return libraryOpenFolderWindowResponseSchema.parse({ action, ok: true });
  });

  dependencies.ipcMain.handle(LIBRARY_PREPARE_FOLDER_REMOVAL_CHANNEL, async (event, rawRequest) => {
    const senderWindow = authorizeSender(event, dependencies, LIBRARY_LIFECYCLE_CAPABILITY);
    if (!senderWindow) {
      return failure('unauthorized', 'This window cannot prepare folder removal.');
    }
    const request = libraryFolderPathRequestSchema.safeParse(rawRequest);
    if (!request.success) {
      return failure('invalid-response', 'The folder removal request was invalid.');
    }
    const readiness = await Promise.all(
      dependencies
        .windowsForFolder(request.data.folderPath)
        .map((window) => coordinator.request(window, request.data.folderPath)),
    );
    return libraryPrepareFolderRemovalResponseSchema.parse({
      ok: true,
      ready: readiness.every(Boolean),
    });
  });

  dependencies.ipcMain.handle(
    LIBRARY_FOLDER_REMOVAL_READY_CHANNEL,
    (event: IpcMainInvokeEvent, rawResponse) => {
      const senderWindow = authorizeSender(event, dependencies, LIBRARY_LIFECYCLE_CAPABILITY);
      if (!senderWindow) {
        return failure('unauthorized', 'This window cannot acknowledge folder removal.');
      }
      if (!coordinator.settle(event.sender.id, rawResponse)) {
        return failure('invalid-response', 'The folder removal acknowledgement was stale.');
      }
      return libraryLifecycleResponseSchema.parse({ ok: true });
    },
  );

  dependencies.ipcMain.handle(LIBRARY_NOTIFY_FOLDER_REMOVED_CHANNEL, (event, rawRequest) => {
    const senderWindow = authorizeSender(event, dependencies, LIBRARY_LIFECYCLE_CAPABILITY);
    if (!senderWindow) {
      return failure('unauthorized', 'This window cannot reconcile folder removal.');
    }
    const request = libraryFolderPathRequestSchema.safeParse(rawRequest);
    if (!request.success) {
      return failure('invalid-response', 'The removed folder request was invalid.');
    }
    for (const window of dependencies.liveWindows()) {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send(LIBRARY_FOLDER_REMOVED_CHANNEL, request.data);
      }
    }
    return libraryLifecycleResponseSchema.parse({ ok: true });
  });
}
