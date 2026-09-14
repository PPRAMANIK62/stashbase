import type { ProjectRegistrySnapshot } from '@/features/workspace/domain/project';

import { projectFailureMessage } from './failure-messages';
import { type ProjectRegistryPort, ProjectError } from './ports';

export type OpenFolderResult =
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'opened'; snapshot: ProjectRegistrySnapshot };

export async function openFolder(
  api: ProjectRegistryPort,
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
      message: projectFailureMessage(
        error instanceof ProjectError ? error.kind : undefined,
        'opened',
      ),
    };
  }
}
