import {
  LIBRARY_FOLDER_DIALOG_CHANNEL,
  type LibraryFolderDialogFailure,
  type LibraryFolderDialogRequest,
  type LibraryFolderDialogResponse,
  libraryFolderDialogRequestSchema,
  libraryFolderDialogResponseSchema,
} from '../../shared/protocols/electron/library.ts';

export interface IpcRenderer {
  invoke(channel: string, payload: unknown): Promise<unknown>;
}

export interface LibraryPreload {
  chooseFolder(
    request?: Partial<LibraryFolderDialogRequest>,
  ): Promise<LibraryFolderDialogResponse>;
}

const unavailable = (): LibraryFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'unavailable',
    message: 'The folder picker is unavailable.',
  },
});

const invalidResponse = (): LibraryFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'invalid-response',
    message: 'The folder picker returned an invalid response.',
  },
});

export function createLibraryPreload(ipcRenderer: IpcRenderer): LibraryPreload {
  return Object.freeze({
    async chooseFolder(request = {}) {
      const parsedRequest = libraryFolderDialogRequestSchema.parse(request);
      let response: unknown;
      try {
        response = await ipcRenderer.invoke(LIBRARY_FOLDER_DIALOG_CHANNEL, parsedRequest);
      } catch {
        return unavailable();
      }
      const parsedResponse = libraryFolderDialogResponseSchema.safeParse(response);
      return parsedResponse.success ? parsedResponse.data : invalidResponse();
    },
  });
}
