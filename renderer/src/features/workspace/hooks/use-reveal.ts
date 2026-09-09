import { useMutation } from '@tanstack/react-query';

import { filesFailure } from '@/features/workspace/application/failure-messages';
import type { FilesPort } from '@/features/workspace/application/ports';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import { useRequestSignals } from '@/lib/runtime/use-request-signals';

/** Revealing one entry in the desktop file manager. A second reveal replaces
 *  the one still in flight, and unmounting drops it. */
export function useReveal(runtime: WorkspaceRuntime, api: FilesPort) {
  const signalFor = useRequestSignals<'reveal'>();
  const operation = useMutation({
    mutationFn: ({ path, signal }: { path: string; signal: AbortSignal }) =>
      api.reveal(runtime.scope.folder.path, path, signal),
  });

  return {
    error: operation.isError ? filesFailure(operation.error).message : null,
    async reveal(path: string): Promise<boolean> {
      try {
        await operation.mutateAsync({ path, signal: signalFor('reveal') });
        return true;
      } catch {
        return false;
      }
    },
  };
}
