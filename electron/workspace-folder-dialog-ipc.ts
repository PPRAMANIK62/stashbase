import type { BrowserWindow, Dialog, IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';

import {
  WORKSPACE_FOLDER_DIALOG_CAPABILITY,
  WORKSPACE_FOLDER_DIALOG_CHANNEL,
  type WorkspaceFolderDialogFailure,
  type WorkspaceFolderDialogResponse,
  workspaceFolderDialogFailureSchema,
  workspaceFolderDialogRequestSchema,
  workspaceFolderDialogResponseSchema,
} from '../shared/protocols/electron/workspace-folder-dialog.ts';

export { WORKSPACE_FOLDER_DIALOG_CAPABILITY };

type BrowserWindowConstructor = {
  fromWebContents(webContents: WebContents): BrowserWindow | null;
};

export interface WorkspaceFolderDialogAuthorization {
  expectedOrigins: ReadonlySet<string>;
  hasCapability(window: BrowserWindow, capability: string): boolean;
  isLiveWindow(window: BrowserWindow): boolean;
}

export interface WorkspaceFolderDialogIpcDependencies extends WorkspaceFolderDialogAuthorization {
  BrowserWindow: BrowserWindowConstructor;
  dialog: Pick<Dialog, 'showOpenDialog'>;
  ipcMain: Pick<IpcMain, 'handle'>;
}

const failure = (
  kind: WorkspaceFolderDialogFailure['failure']['kind'],
  message: string,
): WorkspaceFolderDialogFailure =>
  workspaceFolderDialogFailureSchema.parse({ ok: false, failure: { kind, message } });

function frameOrigin(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.username || url.password) return null;
    if (url.protocol === 'app:' && url.hostname === 'renderer' && !url.port) {
      return 'app://renderer';
    }
    return url.origin === 'null' ? null : url.origin;
  } catch {
    return null;
  }
}

export function authorizeWorkspaceFolderDialogSender(
  event: IpcMainInvokeEvent,
  dependencies: WorkspaceFolderDialogIpcDependencies,
): BrowserWindow | null {
  const senderWindow = dependencies.BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow || !dependencies.isLiveWindow(senderWindow)) return null;
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return null;
  const origin = frameOrigin(event.senderFrame.url);
  if (!origin || !dependencies.expectedOrigins.has(origin)) return null;
  if (!dependencies.hasCapability(senderWindow, WORKSPACE_FOLDER_DIALOG_CAPABILITY)) return null;
  return senderWindow;
}

export function registerWorkspaceFolderDialogIpc(
  dependencies: WorkspaceFolderDialogIpcDependencies,
): void {
  dependencies.ipcMain.handle(
    WORKSPACE_FOLDER_DIALOG_CHANNEL,
    async (event, rawRequest): Promise<WorkspaceFolderDialogResponse> => {
      const senderWindow = authorizeWorkspaceFolderDialogSender(event, dependencies);
      if (!senderWindow) {
        return failure('unauthorized', 'This window cannot open the folder picker.');
      }

      const request = workspaceFolderDialogRequestSchema.safeParse(rawRequest);
      if (!request.success) {
        return failure('invalid-response', 'The folder request was invalid.');
      }

      try {
        const properties: Array<'openDirectory' | 'createDirectory'> = ['openDirectory'];
        if (request.data.allowCreateDirectory) properties.push('createDirectory');
        const result = await dependencies.dialog.showOpenDialog(senderWindow, {
          title: 'Choose a folder',
          properties,
          ...(request.data.defaultPath ? { defaultPath: request.data.defaultPath } : {}),
        });
        return workspaceFolderDialogResponseSchema.parse({
          ok: true,
          folderPath: result.canceled ? null : (result.filePaths[0] ?? null),
        });
      } catch {
        return failure('unavailable', 'The folder picker is unavailable.');
      }
    },
  );
}
