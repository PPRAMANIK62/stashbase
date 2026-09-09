import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { libraryFailureMessage, REMOVAL_MESSAGES } from './failure-messages';
import { type LibraryPort, LibraryError, type LibraryLifecyclePort } from './ports';

export type RemoveFolderResult =
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'removed'; snapshot: LibrarySnapshot; warning: string | null };

export async function removeFolder(
  api: LibraryPort,
  lifecycle: LibraryLifecyclePort,
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
        message: REMOVAL_MESSAGES.blocked,
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
        warning: REMOVAL_MESSAGES.delayed,
      };
    }
  } catch (error) {
    if (signal.aborted) return { status: 'cancelled' };
    return {
      status: 'failed',
      message: libraryFailureMessage(
        error instanceof LibraryError ? error.kind : undefined,
        'removed',
      ),
    };
  }
}
