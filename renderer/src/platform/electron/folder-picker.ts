import {
  type ProjectFolderDialogFailure,
  type ProjectFolderDialogRequest,
  type ProjectFolderDialogResponse,
} from '@/protocols/electron/project';

export interface ProjectBridge {
  chooseFolder(request?: Partial<ProjectFolderDialogRequest>): Promise<ProjectFolderDialogResponse>;
}

export type ProjectFolderPickerResult =
  | { status: 'selected'; folderPath: string }
  | { status: 'cancelled' }
  | { status: 'failed'; failure: ProjectFolderDialogFailure['failure'] };

export interface ProjectFolderPickerPort {
  chooseFolder(request?: Partial<ProjectFolderDialogRequest>): Promise<ProjectFolderPickerResult>;
}

export function mapFolderSelection(
  response: ProjectFolderDialogResponse,
): ProjectFolderPickerResult {
  if (!response.ok) return { status: 'failed', failure: response.failure };
  if (response.folderPath === null) return { status: 'cancelled' };
  return { status: 'selected', folderPath: response.folderPath };
}

export function createFolderPicker(bridge: ProjectBridge): ProjectFolderPickerPort {
  return {
    async chooseFolder(request) {
      return mapFolderSelection(await bridge.chooseFolder(request));
    },
  };
}
