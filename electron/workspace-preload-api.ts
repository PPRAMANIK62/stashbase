import {
  WORKSPACE_FOLDER_DIALOG_CHANNEL,
  type WorkspaceFolderDialogFailure,
  type WorkspaceFolderDialogRequest,
  type WorkspaceFolderDialogResponse,
  workspaceFolderDialogRequestSchema,
  workspaceFolderDialogResponseSchema,
} from '../shared/protocols/electron/workspace-folder-dialog.ts';

export interface WorkspaceIpcRenderer {
  invoke(channel: string, payload: unknown): Promise<unknown>;
}

export interface WorkspacePreloadApi {
  chooseFolder(
    request?: Partial<WorkspaceFolderDialogRequest>,
  ): Promise<WorkspaceFolderDialogResponse>;
}

const unavailable = (): WorkspaceFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'unavailable',
    message: 'The folder picker is unavailable.',
  },
});

const invalidResponse = (): WorkspaceFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'invalid-response',
    message: 'The folder picker returned an invalid response.',
  },
});

export function createWorkspacePreloadApi(ipcRenderer: WorkspaceIpcRenderer): WorkspacePreloadApi {
  return Object.freeze({
    async chooseFolder(request = {}) {
      const parsedRequest = workspaceFolderDialogRequestSchema.parse(request);
      let response: unknown;
      try {
        response = await ipcRenderer.invoke(WORKSPACE_FOLDER_DIALOG_CHANNEL, parsedRequest);
      } catch {
        return unavailable();
      }
      const parsedResponse = workspaceFolderDialogResponseSchema.safeParse(response);
      return parsedResponse.success ? parsedResponse.data : invalidResponse();
    },
  });
}
