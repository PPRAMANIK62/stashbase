import {
  CAPTURE_IMAGE_AVAILABLE_CHANNEL,
  CAPTURE_MARK_CURRENT_HANDLED_CHANNEL,
  CAPTURE_MARK_HANDLED_CHANNEL,
  CAPTURE_REFRESH_WATCH_CHANNEL,
  CAPTURE_SET_COMPOSER_FOCUSED_CHANNEL,
  type CaptureImageAvailable,
  captureImageAvailableSchema,
  captureMarkHandledRequestSchema,
  captureRefreshWatchResponseSchema,
  captureSetComposerFocusedRequestSchema,
} from '../../shared/protocols/electron/capture.ts';

export interface IpcRenderer {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  on(channel: string, listener: (event: unknown, payload: unknown) => void): void;
  send(channel: string, payload?: unknown): void;
}

export interface CapturePreload {
  markCurrentImageHandled(): void;
  markHandled(hash: string): void;
  onImageAvailable(handler: (image: CaptureImageAvailable) => void): () => void;
  /** Resolves to the watch state main applied; false when it could not be read. */
  refreshWatch(): Promise<boolean>;
  setComposerFocused(focused: boolean): void;
}

export function createCapturePreload(ipcRenderer: IpcRenderer): CapturePreload {
  const handlers = new Set<(image: CaptureImageAvailable) => void>();

  ipcRenderer.on(CAPTURE_IMAGE_AVAILABLE_CHANNEL, (_event, payload) => {
    const parsed = captureImageAvailableSchema.safeParse(payload);
    if (!parsed.success) return;
    for (const handler of handlers) handler(parsed.data);
  });

  return Object.freeze({
    markCurrentImageHandled() {
      ipcRenderer.send(CAPTURE_MARK_CURRENT_HANDLED_CHANNEL);
    },
    markHandled(hash: string) {
      const request = captureMarkHandledRequestSchema.safeParse({ hash });
      if (request.success) ipcRenderer.send(CAPTURE_MARK_HANDLED_CHANNEL, request.data);
    },
    onImageAvailable(handler: (image: CaptureImageAvailable) => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    async refreshWatch() {
      try {
        const response = await ipcRenderer.invoke(CAPTURE_REFRESH_WATCH_CHANNEL);
        const parsed = captureRefreshWatchResponseSchema.safeParse(response);
        return parsed.success ? parsed.data.enabled : false;
      } catch {
        return false;
      }
    },
    setComposerFocused(focused: boolean) {
      ipcRenderer.send(
        CAPTURE_SET_COMPOSER_FOCUSED_CHANNEL,
        captureSetComposerFocusedRequestSchema.parse({ focused: focused === true }),
      );
    },
  });
}
