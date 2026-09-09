import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { openFolder } from '@/features/workspace/application/open-folder';
import type { LibraryPort, WorkspaceSessionPort } from '@/features/workspace/application/ports';
import { libraryQuery, workspaceQueryKeys } from '@/features/workspace/application/queries';
import {
  createWorkspaceSessionRuntime,
  type WorkspaceSessionRuntime,
} from '@/features/workspace/application/session-runtime';
import { restoreFolderSession, type FolderSessionState } from '@/features/workspace/domain/session';
import { useRequestSignals } from '@/lib/runtime/use-request-signals';
import { useRetainedRuntime } from '@/lib/runtime/use-retained-runtime';

/**
 * Where session restoration stands, as one value.
 *
 * The three parallel flags this replaced could spell states restoration never
 * reaches — ready while still restoring, a restored folder before the stored
 * session had even been read. Only `ready` carries the folder to restore,
 * because only `ready` has one.
 */
type WorkspaceSessionStatus =
  | { kind: 'restoring' }
  | { kind: 'ready'; restoredFolder: FolderSessionState | null };

export interface WorkspaceSessionController {
  runtime: WorkspaceSessionRuntime;
  status: WorkspaceSessionStatus;
  shell: {
    agentPaneWidth: number;
    sidebarOpen: boolean;
    sidebarWidth: number;
  };
}

export function useWorkspaceSession(
  api: LibraryPort,
  persistence: WorkspaceSessionPort,
): WorkspaceSessionController {
  const queryClient = useQueryClient();
  const runtime = useRetainedRuntime(
    () => createWorkspaceSessionRuntime(persistence),
    (session) => session.dispose(),
  );
  const state = useStore(runtime.store);
  const library = useQuery(libraryQuery(api)).data;
  const attemptedRestore = useRef<string | null>(null);
  // One lane: reopening a different folder replaces the attempt in flight.
  const signalFor = useRequestSignals<'restore-folder'>();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    void runtime.restore();
  }, [runtime]);

  const memberPaths = useMemo(
    () => library?.members.map((member) => member.path) ?? [],
    [library?.members],
  );
  const restorablePath =
    state.restoreStatus === 'ready' &&
    state.snapshot.activeFolderPath &&
    memberPaths.includes(state.snapshot.activeFolderPath)
      ? state.snapshot.activeFolderPath
      : null;

  useEffect(() => {
    if (!library || state.restoreStatus !== 'ready') return;
    runtime.reconcileMembership(memberPaths);

    if (library.activeFolder) {
      attemptedRestore.current = library.activeFolder.path;
      runtime.setActiveFolder(library.activeFolder.path);
      return;
    }

    if (!restorablePath || attemptedRestore.current === restorablePath) {
      if (!restorablePath) runtime.setActiveFolder(null);
      return;
    }

    attemptedRestore.current = restorablePath;
    const capturedLibrary = library;
    setPendingPath(restorablePath);
    void openFolder(api, restorablePath, signalFor('restore-folder')).then((result) => {
      if (
        result.status === 'opened' &&
        queryClient.getQueryData(workspaceQueryKeys.library) === capturedLibrary
      ) {
        queryClient.setQueryData(workspaceQueryKeys.library, result.snapshot);
      } else if (result.status === 'failed') {
        runtime.setActiveFolder(null);
      }
      setPendingPath((current) => (current === restorablePath ? null : current));
    });
    return () => setPendingPath((current) => (current === restorablePath ? null : current));
  }, [
    api,
    library,
    memberPaths,
    queryClient,
    restorablePath,
    runtime,
    signalFor,
    state.restoreStatus,
  ]);

  // A folder the library already has open is not being restored, whatever the
  // saved session still names: the attempt marker below is a ref, so a window
  // that never has to reopen anything would otherwise stay "restoring" with no
  // render left to correct it.
  const restoring =
    state.restoreStatus === 'loading' ||
    pendingPath !== null ||
    (!library?.activeFolder &&
      restorablePath !== null &&
      attemptedRestore.current !== restorablePath);

  return {
    runtime,
    shell: state.snapshot.shell,
    status: restoring
      ? { kind: 'restoring' }
      : {
          kind: 'ready',
          restoredFolder: library?.activeFolder
            ? restoreFolderSession(state.snapshot, library.activeFolder.path)
            : null,
        },
  };
}
