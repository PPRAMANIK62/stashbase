import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { type LibraryApi, LibraryError } from './ports';

export type OpenFolderResult =
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'opened'; snapshot: LibrarySnapshot };

export async function openFolder(
  api: LibraryApi,
  path: string,
  signal: AbortSignal,
): Promise<OpenFolderResult> {
  if (signal.aborted) return { status: 'cancelled' };

  try {
    const snapshot = await api.openFolder(path, signal);
    return signal.aborted ? { status: 'cancelled' } : { status: 'opened', snapshot };
  } catch (error) {
    if (signal.aborted) return { status: 'cancelled' };
    if (error instanceof LibraryError) {
      return { status: 'failed', message: error.message };
    }
    return { status: 'failed', message: 'The folder could not be opened.' };
  }
}
