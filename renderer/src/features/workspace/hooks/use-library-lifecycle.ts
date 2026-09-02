import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import type { LibraryApi, LibraryLifecycle } from '@/features/workspace/application/ports';
import {
  libraryQueryKey,
  retireWorkspaceQueries,
  workspaceQueryKeys,
} from '@/features/workspace/application/queries';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import type { WorkspaceScope } from '@/features/workspace/domain/workspace';

export function useLibraryLifecycle(
  api: LibraryApi,
  lifecycle: LibraryLifecycle,
  runtime: WorkspaceRuntime | null,
  beforeRelease: (folderPath: string) => Promise<boolean> = async () => true,
) {
  const queryClient = useQueryClient();
  const runtimeRef = useRef(runtime);
  const reconciliation = useRef<{ controller: AbortController; generation: number } | null>(null);
  const nextGeneration = useRef(0);

  useLayoutEffect(() => {
    const previous = runtimeRef.current;
    if (!runtime && previous) {
      const snapshot = queryClient.getQueryData<LibrarySnapshot>(libraryQueryKey);
      const remainsAuthorized = snapshot?.members.some(
        (member) => member.path === previous.scope.folder.path,
      );
      if (remainsAuthorized === false) previous.retire();
    }
    runtimeRef.current = runtime;
  }, [queryClient, runtime]);

  const beginReconciliation = useCallback(() => {
    reconciliation.current?.controller.abort();
    const controller = new AbortController();
    const generation = ++nextGeneration.current;
    reconciliation.current = { controller, generation };
    return { controller, generation };
  }, []);

  const isCurrent = useCallback(
    (generation: number) =>
      reconciliation.current?.generation === generation &&
      !reconciliation.current.controller.signal.aborted,
    [],
  );

  const retireFolder = useCallback(
    async (folderPath: string) => {
      const current = runtimeRef.current;
      if (current?.scope.folder.path === folderPath) {
        if (!(await beforeRelease(folderPath))) return false;
        current.retire();
      }
      await retireWorkspaceQueries(queryClient, folderPath);
      return true;
    },
    [beforeRelease, queryClient],
  );

  const reconcileRemovedFolder = useCallback(
    (folderPath: string) => {
      const { controller, generation } = beginReconciliation();
      void api
        .load(controller.signal)
        .then(async (snapshot) => {
          if (!isCurrent(generation)) return;
          const remainsAuthorized = snapshot.members.some((member) => member.path === folderPath);
          if (!remainsAuthorized && !(await retireFolder(folderPath))) return;
          if (!isCurrent(generation)) return;
          queryClient.setQueryData(libraryQueryKey, snapshot);
        })
        .catch(() => {
          // The event is a reconciliation hint. Without authoritative membership,
          // preserve the mounted workspace and let its local recovery stay visible.
        });
    },
    [api, beginReconciliation, isCurrent, queryClient, retireFolder],
  );

  const recoverLostScope = useCallback(
    (capturedScope: WorkspaceScope) => {
      const current = runtimeRef.current;
      if (
        !current ||
        current.scope.generation !== capturedScope.generation ||
        current.scope.folder.path !== capturedScope.folder.path
      ) {
        return;
      }
      const { controller, generation } = beginReconciliation();
      void api
        .load(controller.signal)
        .then(async (snapshot) => {
          if (!isCurrent(generation) || runtimeRef.current !== current) return;
          const remainsAuthorized = snapshot.members.some(
            (member) => member.path === capturedScope.folder.path,
          );
          if (!remainsAuthorized) {
            if (!(await retireFolder(capturedScope.folder.path))) return;
            if (isCurrent(generation)) queryClient.setQueryData(libraryQueryKey, snapshot);
            return;
          }

          try {
            const rebound = await api.openFolder(capturedScope.folder.path, controller.signal);
            if (!isCurrent(generation) || runtimeRef.current !== current) return;
            queryClient.setQueryData(libraryQueryKey, rebound);
            await queryClient.invalidateQueries({
              queryKey: workspaceQueryKeys.folder(capturedScope.folder.path),
            });
          } catch {
            // Membership still authorizes the folder. Preserve cached UI and its
            // failure instead of converting a transient server loss into removal.
          }
        })
        .catch(() => {
          // Server loss is not proof of scope loss; retain the runtime for retry.
        });
    },
    [api, beginReconciliation, isCurrent, queryClient, retireFolder],
  );

  useEffect(() => {
    const unsubscribePreparation = lifecycle.onPrepareFolderRemoval(beforeRelease);
    const unsubscribeRemoval = lifecycle.onFolderRemoved(reconcileRemovedFolder);
    return () => {
      unsubscribePreparation();
      unsubscribeRemoval();
    };
  }, [beforeRelease, lifecycle, reconcileRemovedFolder]);

  useEffect(() => {
    void lifecycle.setActiveFolder(runtime?.scope.folder.path ?? null).catch(() => undefined);
  }, [lifecycle, runtime?.scope.folder.path]);

  useEffect(
    () => () => {
      reconciliation.current?.controller.abort();
    },
    [],
  );

  return { recoverLostScope };
}
