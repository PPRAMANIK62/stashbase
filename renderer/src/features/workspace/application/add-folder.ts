import { openFolder, type OpenFolderResult } from './open-folder';
import { type FolderPickerOptions, type LibraryFolderPicker, type LibraryApi } from './ports';

export type AddFolderResult = OpenFolderResult;

export async function addFolder(
  folderPicker: LibraryFolderPicker,
  api: LibraryApi,
  signal: AbortSignal,
  options?: FolderPickerOptions,
): Promise<AddFolderResult> {
  const selection = await folderPicker.chooseFolder(options);
  if (selection.status === 'cancelled') return { status: 'cancelled' };
  if (selection.status === 'failed') {
    return { status: 'failed', message: selection.failure.message };
  }
  if (signal.aborted) return { status: 'cancelled' };
  return openFolder(api, selection.folderPath, signal);
}
