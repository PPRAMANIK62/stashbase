import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { type LibraryApi, LibraryError, type LibraryLifecycle } from './ports';

export type RemoveFolderResult =
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'removed'; snapshot: LibrarySnapshot; warning: string | null };

export async function removeFolder(
  api: LibraryApi,
  lifecycle: LibraryLifecycle,
  folderPath: string,
  signal: AbortSignal,
): Promise<RemoveFolderResult> {
  if (signal.aborted) return { status: 'cancelled' };

  try {
    const ready = await lifecycle.prepareFolderRemoval(folderPath);
    if (signal.aborted) return { status: 'cancelled' };
    if (!ready) {
      return {
        status: 'failed',
        message: 'A window could not release this folder. Resolve its save error and try again.',
      };
    }
    const snapshot = await api.removeFolder(folderPath, signal);
    if (signal.aborted) return { status: 'cancelled' };
    try {
      await lifecycle.notifyFolderRemoved(folderPath);
      return { status: 'removed', snapshot, warning: null };
    } catch {
      return {
        status: 'removed',
        snapshot,
        warning: 'The folder was removed. Another window may take a moment to refresh.',
      };
    }
  } catch (error) {
    if (signal.aborted) return { status: 'cancelled' };
    if (error instanceof LibraryError) return { status: 'failed', message: error.message };
    return { status: 'failed', message: 'The folder could not be removed.' };
  }
}
