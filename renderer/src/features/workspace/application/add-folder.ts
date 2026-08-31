import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import {
  type FolderPickerOptions,
  type LibraryFolderPicker,
  type LibraryApi,
  LibraryError,
} from './ports';

export type AddFolderResult =
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'opened'; snapshot: LibrarySnapshot };

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
  try {
    return {
      status: 'opened',
      snapshot: await api.openFolder(selection.folderPath, signal),
    };
  } catch (error) {
    if (signal.aborted) return { status: 'cancelled' };
    if (error instanceof LibraryError) {
      return { status: 'failed', message: error.message };
    }
    return { status: 'failed', message: 'The folder could not be opened.' };
  }
}
