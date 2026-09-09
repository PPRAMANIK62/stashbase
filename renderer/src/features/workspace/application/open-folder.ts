import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { libraryFailureMessage } from './failure-messages';
import { type LibraryPort, LibraryError } from './ports';

export type OpenFolderResult =
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'opened'; snapshot: LibrarySnapshot };

export async function openFolder(
  api: LibraryPort,
  path: string,
  signal: AbortSignal,
): Promise<OpenFolderResult> {
  if (signal.aborted) return { status: 'cancelled' };

  try {
    const snapshot = await api.openFolder(path, signal);
    return signal.aborted ? { status: 'cancelled' } : { status: 'opened', snapshot };
  } catch (error) {
    if (signal.aborted) return { status: 'cancelled' };
    return {
      status: 'failed',
      message: libraryFailureMessage(
        error instanceof LibraryError ? error.kind : undefined,
        'opened',
      ),
    };
  }
}
