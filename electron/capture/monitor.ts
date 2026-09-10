import crypto from 'node:crypto';
import type { BrowserWindow, IpcMain, IpcMainEvent, IpcMainInvokeEvent, NativeImage } from 'electron';

import {
  CAPTURE_CAPABILITY,
  CAPTURE_IMAGE_AVAILABLE_CHANNEL,
  CAPTURE_MARK_CURRENT_HANDLED_CHANNEL,
  CAPTURE_MARK_HANDLED_CHANNEL,
  CAPTURE_REFRESH_WATCH_CHANNEL,
  CAPTURE_SET_COMPOSER_FOCUSED_CHANNEL,
  type CaptureRefreshWatchResponse,
  captureImageAvailableSchema,
  captureMarkHandledRequestSchema,
  captureSetComposerFocusedRequestSchema,
} from '../../shared/protocols/electron/capture.ts';
import { authorizeSender, type SenderAuthorization } from '../library/dialog.ts';

export { CAPTURE_CAPABILITY };

export const CAPTURE_POLL_MS = 600;

interface MonitorWebContents {
  id: number;
  isDestroyed(): boolean;
  send(channel: string, payload: unknown): void;
}

export type MonitorWindow = BrowserWindow & {
  isFocused(): boolean;
  webContents: MonitorWebContents;
};

export interface ClipboardReader {
  readImage(): Pick<NativeImage, 'isEmpty' | 'toPNG' | 'toDataURL' | 'getSize'>;
}

export interface MonitorDependencies extends SenderAuthorization {
  clipboard: ClipboardReader;
  focusedWindow(): MonitorWindow | null;
  ipcMain: Pick<IpcMain, 'handle' | 'on'>;
  /** Reads the durable opt-in; any failure means monitoring stays off. */
  readPreference(): Promise<boolean>;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  shouldOffer(input: { enabled: boolean; focused: boolean; composerFocused: boolean }): boolean;
}

export function clipboardImageFilename(now = new Date()): string {
  return `clipboard-${now.toISOString().replace(/[:.]/g, '-')}.png`;
}

function readPng(clipboard: ClipboardReader) {
  let image: ReturnType<ClipboardReader['readImage']>;
  try {
    image = clipboard.readImage();
  } catch {
    return null;
  }
  if (!image || image.isEmpty()) return null;
  let png: Buffer;
  try {
    png = image.toPNG();
  } catch {
    return null;
  }
  if (!png || png.length === 0) return null;
  return { image, png };
}

export interface CaptureMonitor {
  /** For the focus handler: offer to a window that just gained focus. */
  offerTo(window: MonitorWindow): void;
  stop(): void;
}

export function registerCaptureMonitor(dependencies: MonitorDependencies): CaptureMonitor {
  const schedule = dependencies.setInterval ?? setInterval;
  const cancel = dependencies.clearInterval ?? clearInterval;
  let enabled = false;
  let lastOfferHash: string | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const composerFocused = new Set<number>();

  const offer = (window: MonitorWindow | null, focused: boolean) => {
    if (!window || window.isDestroyed() || !dependencies.isLiveWindow(window)) return;
    if (
      !dependencies.shouldOffer({
        composerFocused: composerFocused.has(window.webContents.id),
        enabled,
        focused,
      })
    ) {
      return;
    }
    const read = readPng(dependencies.clipboard);
    if (!read) return;
    const hash = crypto.createHash('sha1').update(read.png).digest('hex');
    if (hash === lastOfferHash) return;
    lastOfferHash = hash;
    const size = read.image.getSize();
    const payload = captureImageAvailableSchema.parse({
      dataUrl: read.image.toDataURL(),
      filename: clipboardImageFilename(),
      hash,
      height: size.height,
      mime: 'image/png',
      width: size.width,
    });
    if (!window.webContents.isDestroyed()) {
      window.webContents.send(CAPTURE_IMAGE_AVAILABLE_CHANNEL, payload);
    }
  };

  const stopPolling = () => {
    if (pollTimer !== null) {
      cancel(pollTimer);
      pollTimer = null;
    }
  };

  const startPolling = () => {
    if (pollTimer !== null || !enabled) return;
    pollTimer = schedule(() => {
      const window = dependencies.focusedWindow();
      if (window && dependencies.isLiveWindow(window)) offer(window, true);
      else stopPolling();
    }, CAPTURE_POLL_MS);
  };

  dependencies.ipcMain.handle(
    CAPTURE_REFRESH_WATCH_CHANNEL,
    async (event: IpcMainInvokeEvent): Promise<CaptureRefreshWatchResponse> => {
      const senderWindow = authorizeSender(event, dependencies, CAPTURE_CAPABILITY) as
        | MonitorWindow
        | null;
      if (!senderWindow) return { enabled: false };
      const wasEnabled = enabled;
      let next = false;
      try {
        next = (await dependencies.readPreference()) === true;
      } catch {
        next = false;
      }
      enabled = next;
      if (enabled) {
        if (!wasEnabled) lastOfferHash = null;
        if (senderWindow.isFocused()) {
          offer(senderWindow, true);
          startPolling();
        }
      } else {
        stopPolling();
      }
      return { enabled };
    },
  );

  const authorizedSender = (event: IpcMainEvent) =>
    authorizeSender(event as unknown as IpcMainInvokeEvent, dependencies, CAPTURE_CAPABILITY);

  dependencies.ipcMain.on(CAPTURE_MARK_HANDLED_CHANNEL, (event, payload) => {
    if (!authorizedSender(event)) return;
    const request = captureMarkHandledRequestSchema.safeParse(payload);
    if (request.success) lastOfferHash = request.data.hash;
  });

  dependencies.ipcMain.on(CAPTURE_MARK_CURRENT_HANDLED_CHANNEL, (event) => {
    if (!authorizedSender(event)) return;
    const read = readPng(dependencies.clipboard);
    if (read) lastOfferHash = crypto.createHash('sha1').update(read.png).digest('hex');
  });

  dependencies.ipcMain.on(CAPTURE_SET_COMPOSER_FOCUSED_CHANNEL, (event, payload) => {
    if (!authorizedSender(event)) return;
    const request = captureSetComposerFocusedRequestSchema.safeParse(payload);
    if (!request.success) return;
    if (request.data.focused) composerFocused.add(event.sender.id);
    else composerFocused.delete(event.sender.id);
  });

  return {
    offerTo(window) {
      offer(window, window.isFocused());
      startPolling();
    },
    stop: stopPolling,
  };
}
