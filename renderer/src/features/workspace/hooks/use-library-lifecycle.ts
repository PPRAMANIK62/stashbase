/**
 * Reconciliation between native folder membership and the mounted workspace.
 *
 * Both recovery paths — a folder the host says was removed, and a scope this
 * window lost — share one reconciliation lane: starting either abandons the
 * other, and every step after an await asks whether its own signal is still
 * the live one before writing anything. Unmounting aborts the lane.
 *
 * Telling the host which folder this window is on can itself fail, and a
 * window whose host disagrees about its folder can no longer reconcile
 * anything. That refusal is reported rather than swallowed.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { filesFailure } from '@/features/workspace/application/failure-messages';
import type { LibraryPort, LibraryLifecyclePort } from '@/features/workspace/application/ports';
import {
  workspaceQueryKeys,
  retireWorkspaceQueries,
} from '@/features/workspace/application/queries';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import type { WorkspaceScope } from '@/features/workspace/domain/workspace';
import { useRequestSignals } from '@/lib/runtime/use-request-signals';

export function useLibraryLifecycle(
  api: LibraryPort,
  lifecycle: LibraryLifecyclePort,
  runtime: WorkspaceRuntime | null,
  beforeRelease: (folderPath: string) => Promise<boolean> = async () => true,
) {
  const queryClient = useQueryClient();
  const runtimeRef = useRef(runtime);
  const signalFor = useRequestSignals<'reconcile'>();

  useLayoutEffect(() => {
    const previous = runtimeRef.current;
    if (!runtime && previous) {
      const snapshot = queryClient.getQueryData<LibrarySnapshot>(workspaceQueryKeys.library);
      const remainsAuthorized = snapshot?.members.some(
        (member) => member.path === previous.scope.folder.path,
      );
      if (remainsAuthorized === false) previous.retire();
    }
    runtimeRef.current = runtime;
  }, [queryClient, runtime]);

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
      const signal = signalFor('reconcile');
      void api
        .load(signal)
        .then(async (snapshot) => {
          if (signal.aborted) return;
          const remainsAuthorized = snapshot.members.some((member) => member.path === folderPath);
          if (!remainsAuthorized && !(await retireFolder(folderPath))) return;
          if (signal.aborted) return;
          queryClient.setQueryData(workspaceQueryKeys.library, snapshot);
        })
        .catch(() => {
          // The event is a reconciliation hint. Without authoritative membership,
          // preserve the mounted workspace and let its local recovery stay visible.
        });
    },
    [api, queryClient, retireFolder, signalFor],
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
      const signal = signalFor('reconcile');
      void api
        .load(signal)
        .then(async (snapshot) => {
          if (signal.aborted || runtimeRef.current !== current) return;
          const remainsAuthorized = snapshot.members.some(
            (member) => member.path === capturedScope.folder.path,
          );
          if (!remainsAuthorized) {
            if (!(await retireFolder(capturedScope.folder.path))) return;
            if (!signal.aborted) queryClient.setQueryData(workspaceQueryKeys.library, snapshot);
            return;
          }

          try {
            const rebound = await api.openFolder(capturedScope.folder.path, signal);
            if (signal.aborted || runtimeRef.current !== current) return;
            // The folder is being re-read from scratch. Work captured against
            // the tree before that is no longer about this folder, so its
            // completions are retired rather than allowed to land on top.
            current.retireOperations();
            queryClient.setQueryData(workspaceQueryKeys.library, rebound);
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
    [api, queryClient, retireFolder, signalFor],
  );

  useEffect(() => {
    const unsubscribePreparation = lifecycle.onPrepareFolderRemoval(beforeRelease);
    const unsubscribeRemoval = lifecycle.onFolderRemoved(reconcileRemovedFolder);
    return () => {
      unsubscribePreparation();
      unsubscribeRemoval();
    };
  }, [beforeRelease, lifecycle, reconcileRemovedFolder]);

  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void lifecycle
      .setActiveFolder(runtime?.scope.folder.path ?? null)
      .then(() => {
        if (current) setFailure(null);
      })
      .catch((error: unknown) => {
        if (current) setFailure(filesFailure(error).message);
      });
    return () => {
      current = false;
    };
  }, [lifecycle, runtime?.scope.folder.path]);

  return { failure, recoverLostScope };
}
