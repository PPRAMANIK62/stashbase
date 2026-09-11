import {
  WINDOW_FULLSCREEN_CHANNEL,
  windowFullScreenSchema,
} from '../../shared/protocols/electron/window-lifecycle.ts';

interface DocumentRoot {
  dataset: { platform?: string };
  toggleAttribute(name: string, force?: boolean): boolean;
}

interface MarkedDocument {
  readonly documentElement: DocumentRoot | null;
  addEventListener(type: 'DOMContentLoaded', listener: () => void): void;
}

interface IpcRenderer {
  on(channel: string, listener: (event: unknown, payload: unknown) => void): void;
}

/**
 * The marks on the document root the shell's stylesheet reads: which desktop
 * drew the window's chrome, and whether native fullscreen is hiding it. On
 * macOS the traffic lights float over the top-left corner of the frameless
 * window, and the shell makes room for them from these two facts alone.
 *
 * The platform is stamped as soon as the root exists and before the page's
 * own scripts run, so the first paint already has it. Fullscreen arrives from
 * the desktop, which pushes it on every change and once the document has
 * loaded; a payload that is not the one boolean is ignored.
 */
export function stampDocumentMarks(
  ipcRenderer: IpcRenderer,
  document: MarkedDocument,
  platform: string,
): void {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    if (root) root.dataset.platform = platform;
  });
  ipcRenderer.on(WINDOW_FULLSCREEN_CHANNEL, (_event, payload) => {
    const parsed = windowFullScreenSchema.safeParse(payload);
    const root = document.documentElement;
    if (parsed.success && root) root.toggleAttribute('data-fullscreen', parsed.data.fullscreen);
  });
}
