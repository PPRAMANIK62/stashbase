import { projectFailureMessage } from './failure-messages';
import { openFolder, type OpenFolderResult } from './open-folder';
import {
  type FolderPickerOptions,
  type ProjectFolderPickerPort,
  type ProjectRegistryPort,
} from './ports';

export type AddFolderResult = OpenFolderResult;

export async function addFolder(
  folderPicker: ProjectFolderPickerPort,
  api: ProjectRegistryPort,
  signal: AbortSignal,
  options?: FolderPickerOptions,
): Promise<AddFolderResult> {
  const selection = await folderPicker.chooseFolder(options);
  if (selection.status === 'cancelled') return { status: 'cancelled' };
  if (selection.status === 'failed') {
    return { status: 'failed', message: projectFailureMessage(selection.failure.kind, 'opened') };
  }
  if (signal.aborted) return { status: 'cancelled' };
  return openFolder(api, selection.folderPath, signal);
}
