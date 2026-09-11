import crypto from 'node:crypto';
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';

import {
  WINDOW_CONTEXT_RELEASE_READY_CHANNEL,
  WINDOW_FULLSCREEN_CHANNEL,
  WINDOW_LIFECYCLE_CAPABILITY,
  WINDOW_PREPARE_CONTEXT_RELEASE_CHANNEL,
  WINDOW_SAFE_RELOAD_CHANNEL,
  type WindowContextReleaseReason,
  windowContextReleaseReadySchema,
  windowFullScreenSchema,
  windowLifecycleResponseSchema,
} from '../../shared/protocols/electron/window-lifecycle.ts';
import { authorizeSender, type SenderAuthorization } from '../library/dialog.ts';

export { WINDOW_LIFECYCLE_CAPABILITY };

interface LifecycleWebContents {
  id: number;
  isDestroyed(): boolean;
  reload(): void;
  send(channel: string, payload: unknown): void;
  on(event: 'did-finish-load', listener: () => void): void;
}

type LifecycleWindow = BrowserWindow & { webContents: LifecycleWebContents };

export interface WindowLifecycleDependencies extends SenderAuthorization {
  ipcMain: Pick<IpcMain, 'handle'>;
  isLiveWindow(window: BrowserWindow | null): boolean;
}

export function registerWindowLifecycle(
  dependencies: WindowLifecycleDependencies,
  {
    createRequestId = () => crypto.randomUUID(),
    timeoutMs = 5_000,
  }: { createRequestId?: () => string; timeoutMs?: number } = {},
) {
  const loaded = new WeakSet<LifecycleWindow>();
  const approvedClose = new WeakSet<LifecycleWindow>();
  const closing = new WeakSet<LifecycleWindow>();
  const pendingByWebContents = new Map<
    number,
    {
      promise: Promise<boolean>;
      reason: WindowContextReleaseReason;
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

  const request = (
    window: LifecycleWindow,
    reason: WindowContextReleaseReason,
  ): Promise<boolean> => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) return Promise.resolve(false);
    if (!loaded.has(window)) return Promise.resolve(true);
    const webContentsId = window.webContents.id;
    const existing = pendingByWebContents.get(webContentsId);
    if (existing) {
      return existing.reason === reason ? existing.promise : Promise.resolve(false);
    }

    const requestId = createRequestId();
    let resolve!: (ready: boolean) => void;
    const promise = new Promise<boolean>((done) => {
      resolve = done;
    });
    const timer = setTimeout(() => settle(webContentsId, false), timeoutMs);
    timer.unref?.();
    pendingByWebContents.set(webContentsId, { promise, reason, requestId, resolve, timer });
    window.webContents.send(WINDOW_PREPARE_CONTEXT_RELEASE_CHANNEL, { reason, requestId });
    return promise;
  };

  dependencies.ipcMain.handle(
    WINDOW_CONTEXT_RELEASE_READY_CHANNEL,
    (event: IpcMainInvokeEvent, rawResponse) => {
      const senderWindow = authorizeSender(
        event,
        dependencies,
        WINDOW_LIFECYCLE_CAPABILITY,
      ) as LifecycleWindow | null;
      if (!senderWindow) return windowLifecycleResponseSchema.parse({ ok: true, reloaded: false });
      const response = windowContextReleaseReadySchema.safeParse(rawResponse);
      const pending = pendingByWebContents.get(event.sender.id);
      if (
        !response.success ||
        !pending ||
        pending.requestId !== response.data.requestId ||
        pending.reason !== response.data.reason
      ) {
        return windowLifecycleResponseSchema.parse({ ok: true, reloaded: false });
      }
      settle(event.sender.id, response.data.ready);
      return windowLifecycleResponseSchema.parse({ ok: true, reloaded: false });
    },
  );

  dependencies.ipcMain.handle(WINDOW_SAFE_RELOAD_CHANNEL, async (event) => {
    const senderWindow = authorizeSender(
      event,
      dependencies,
      WINDOW_LIFECYCLE_CAPABILITY,
    ) as LifecycleWindow | null;
    if (!senderWindow || !(await request(senderWindow, 'window-reload'))) {
      return windowLifecycleResponseSchema.parse({ ok: true, reloaded: false });
    }
    if (!dependencies.isLiveWindow(senderWindow) || senderWindow.webContents.isDestroyed()) {
      return windowLifecycleResponseSchema.parse({ ok: true, reloaded: false });
    }
    loaded.delete(senderWindow);
    senderWindow.webContents.reload();
    return windowLifecycleResponseSchema.parse({ ok: true, reloaded: true });
  });

  return {
    attach(window: LifecycleWindow) {
      const webContentsId = window.webContents.id;
      // Native fullscreen hides the platform's own chrome, and the shell lays
      // itself out around that chrome, so the state is pushed on every change
      // and once more when a document has loaded and can hear it.
      const pushFullScreen = () => {
        if (window.isDestroyed() || window.webContents.isDestroyed()) return;
        window.webContents.send(
          WINDOW_FULLSCREEN_CHANNEL,
          windowFullScreenSchema.parse({ fullscreen: window.isFullScreen() }),
        );
      };
      window.on('enter-full-screen', pushFullScreen);
      window.on('leave-full-screen', pushFullScreen);
      window.webContents.on('did-finish-load', () => {
        loaded.add(window);
        pushFullScreen();
      });
      window.on('close', (event) => {
        if (approvedClose.has(window) || !loaded.has(window)) return;
        event.preventDefault();
        if (closing.has(window)) return;
        closing.add(window);
        void request(window, 'window-close')
          .then((ready) => {
            if (!ready || !dependencies.isLiveWindow(window)) return;
            approvedClose.add(window);
            window.close();
          })
          .finally(() => closing.delete(window));
      });
      window.on('closed', () => settle(webContentsId, false));
    },
    hasLoadedRenderer(window: LifecycleWindow) {
      return loaded.has(window);
    },
    requestContextRelease(window: LifecycleWindow, reason: WindowContextReleaseReason) {
      return request(window, reason);
    },
    approveClose(window: LifecycleWindow) {
      approvedClose.add(window);
    },
    revokeCloseApproval(window: LifecycleWindow) {
      approvedClose.delete(window);
    },
  };
}
