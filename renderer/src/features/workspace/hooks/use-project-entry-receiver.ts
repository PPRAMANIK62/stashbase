import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { ENTRY_MESSAGES } from '@/features/workspace/application/failure-messages';
import { openFolder } from '@/features/workspace/application/open-folder';
import type {
  ProjectLifecyclePort,
  ProjectRegistryPort,
} from '@/features/workspace/application/ports';
import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import type { ProjectRegistrySnapshot } from '@/features/workspace/domain/project';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

/** Main selects the window; this window acknowledges only after its workspace
 * is mounted. HTTP registration alone does not establish renderer readiness. */
export function useProjectEntryReceiver(
  api: ProjectRegistryPort,
  lifecycle: ProjectLifecyclePort,
  readyPath: string | null,
) {
  const signalFor = useRequestSignals<'receive'>();
  const queryClient = useQueryClient();
  const ready = useRef(readyPath);
  const waiting = useRef<{ path: string; finish(): void } | null>(null);
  useEffect(() => {
    ready.current = readyPath;
    if (waiting.current?.path === readyPath) waiting.current.finish();
  }, [readyPath]);

  useEffect(() => {
    const lifetime = signalFor('receive');
    const unsubscribe = lifecycle.onEnterFolder(async (path, requestSignal) => {
      const signal = AbortSignal.any([requestSignal, lifetime, AbortSignal.timeout(25_000)]);
      if (ready.current) return ready.current === path ? null : ENTRY_MESSAGES.occupied;
      const previous = queryClient.getQueryData<ProjectRegistrySnapshot>(
        workspaceQueryKeys.project,
      );
      const result = await openFolder(api, path, signal);
      if (result.status === 'failed') return result.message;
      if (result.status !== 'opened') return ENTRY_MESSAGES.interrupted;
      const openedPath = result.snapshot.activeFolder?.path;
      if (!openedPath) return ENTRY_MESSAGES.failed;
      const current = queryClient.getQueryData<ProjectRegistrySnapshot>(workspaceQueryKeys.project);
      if (current !== previous && current?.activeFolder && current.activeFolder.path !== openedPath)
        return ENTRY_MESSAGES.occupied;
      queryClient.setQueryData(workspaceQueryKeys.project, result.snapshot);
      if (ready.current === openedPath) return null;
      return new Promise<string | null>((resolve) => {
        const finish = (failure: string | null) => {
          signal.removeEventListener('abort', aborted);
          waiting.current = null;
          resolve(failure);
        };
        const aborted = () => finish(ENTRY_MESSAGES.notReady);
        waiting.current = { path: openedPath, finish: () => finish(null) };
        signal.addEventListener('abort', aborted, { once: true });
        if (signal.aborted) aborted();
      });
    });
    return () => {
      signalFor('receive');
      unsubscribe();
    };
  }, [api, lifecycle, queryClient, signalFor]);
}
