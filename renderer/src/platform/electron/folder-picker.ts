import {
  type LibraryFolderDialogFailure,
  type LibraryFolderDialogRequest,
  type LibraryFolderDialogResponse,
} from '@/protocols/electron/library';

export interface LibraryBridge {
  chooseFolder(request?: Partial<LibraryFolderDialogRequest>): Promise<LibraryFolderDialogResponse>;
}

export type LibraryFolderPickerResult =
  | { status: 'selected'; folderPath: string }
  | { status: 'cancelled' }
  | { status: 'failed'; failure: LibraryFolderDialogFailure['failure'] };

export interface LibraryFolderPicker {
  chooseFolder(request?: Partial<LibraryFolderDialogRequest>): Promise<LibraryFolderPickerResult>;
}

export function mapFolderSelection(
  response: LibraryFolderDialogResponse,
): LibraryFolderPickerResult {
  if (!response.ok) return { status: 'failed', failure: response.failure };
  if (response.folderPath === null) return { status: 'cancelled' };
  return { status: 'selected', folderPath: response.folderPath };
}

export function createFolderPicker(bridge: LibraryBridge): LibraryFolderPicker {
  return {
    async chooseFolder(request) {
      return mapFolderSelection(await bridge.chooseFolder(request));
    },
  };
}
