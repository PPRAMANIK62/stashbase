import {
  type WorkspaceFolderDialogFailure,
  type WorkspaceFolderDialogRequest,
  type WorkspaceFolderDialogResponse,
} from '../../../../shared/protocols/electron/workspace-folder-dialog';

export interface WorkspaceBridge {
  chooseFolder(
    request?: Partial<WorkspaceFolderDialogRequest>,
  ): Promise<WorkspaceFolderDialogResponse>;
}

export type WorkspaceFolderPickerResult =
  | { status: 'selected'; folderPath: string }
  | { status: 'cancelled' }
  | { status: 'failed'; failure: WorkspaceFolderDialogFailure['failure'] };

export interface WorkspaceFolderPicker {
  chooseFolder(
    request?: Partial<WorkspaceFolderDialogRequest>,
  ): Promise<WorkspaceFolderPickerResult>;
}

export function mapWorkspaceFolderDialogResponse(
  response: WorkspaceFolderDialogResponse,
): WorkspaceFolderPickerResult {
  if (!response.ok) return { status: 'failed', failure: response.failure };
  if (response.folderPath === null) return { status: 'cancelled' };
  return { status: 'selected', folderPath: response.folderPath };
}

export function createWorkspaceFolderPicker(bridge: WorkspaceBridge): WorkspaceFolderPicker {
  return {
    async chooseFolder(request) {
      return mapWorkspaceFolderDialogResponse(await bridge.chooseFolder(request));
    },
  };
}
