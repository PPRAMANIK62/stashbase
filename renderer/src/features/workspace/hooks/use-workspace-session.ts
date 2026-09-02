import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { openFolder } from '@/features/workspace/application/open-folder';
import type {
  LibraryApi,
  WorkspaceSessionPersistence,
} from '@/features/workspace/application/ports';
import { libraryQuery, libraryQueryKey } from '@/features/workspace/application/queries';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import {
  createWorkspaceSessionRuntime,
  type WorkspaceSessionRuntime,
} from '@/features/workspace/application/session-runtime';
import { restoreFolderSession } from '@/features/workspace/domain/session';

export interface WorkspaceSessionController {
  isReady: boolean;
  isRestoringFolder: boolean;
  restoredFolder: ReturnType<typeof restoreFolderSession>;
  runtime: WorkspaceSessionRuntime;
  shell: {
    sidebarOpen: boolean;
    sidebarWidth: number;
  };
}

export function useWorkspaceSession(
  api: LibraryApi,
  persistence: WorkspaceSessionPersistence,
): WorkspaceSessionController {
  const queryClient = useQueryClient();
  const [runtime] = useState(() => createWorkspaceSessionRuntime(persistence));
  const state = useStore(runtime.store);
  const library = useQuery(libraryQuery(api)).data;
  const attemptedRestore = useRef<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const mountCount = useRef(0);

  useEffect(() => {
    mountCount.current += 1;
    void runtime.restore();
    return () => {
      mountCount.current -= 1;
      queueMicrotask(() => {
        if (mountCount.current === 0) runtime.dispose();
      });
    };
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
    const controller = new AbortController();
    setPendingPath(restorablePath);
    void openFolder(api, restorablePath, controller.signal).then((result) => {
      if (
        result.status === 'opened' &&
        queryClient.getQueryData(libraryQueryKey) === capturedLibrary
      ) {
        queryClient.setQueryData(libraryQueryKey, result.snapshot);
      } else if (result.status === 'failed') {
        runtime.setActiveFolder(null);
      }
      setPendingPath((current) => (current === restorablePath ? null : current));
    });
    return () => {
      controller.abort();
      setPendingPath((current) => (current === restorablePath ? null : current));
    };
  }, [api, library, memberPaths, queryClient, restorablePath, runtime, state.restoreStatus]);

  return {
    isReady: state.restoreStatus === 'ready',
    isRestoringFolder:
      state.restoreStatus === 'loading' ||
      pendingPath !== null ||
      (!!restorablePath && attemptedRestore.current !== restorablePath),
    restoredFolder: library?.activeFolder
      ? restoreFolderSession(state.snapshot, library.activeFolder.path)
      : null,
    runtime,
    shell: state.snapshot.shell,
  };
}

export function usePersistWorkspaceSession(
  session: WorkspaceSessionRuntime,
  workspace: WorkspaceRuntime | null,
): void {
  useEffect(() => {
    if (!workspace) return;
    const record = () => session.recordWorkspace(workspace.store.getState());
    record();
    return workspace.store.subscribe(record);
  }, [session, workspace]);
}
