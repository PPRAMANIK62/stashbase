import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import type { LibraryPort } from '@/features/workspace/application/ports';
import { createWorkspaceQueryScope, libraryQuery } from '@/features/workspace/application/queries';
import {
  createWorkspaceRuntime,
  type WorkspaceRuntime,
} from '@/features/workspace/application/runtime';
import { useScopedRuntime } from '@/shared/runtime/use-scoped-runtime';

import type { WorkspaceSessionController } from './use-workspace-session';

/**
 * The workspace runtime for the folder the library says is active.
 *
 * A runtime is built per folder and per generation and never outlives either,
 * so nothing can act on a folder the reader has already left. The session is
 * both an input and an output: it decides when a folder may be opened at all
 * (nothing is restored before the saved session has loaded) and it records the
 * runtime's state back as it changes, which is why the two are one call rather
 * than a runtime plus a persistence hook a caller could forget.
 */
export function useWorkspace(
  api: LibraryPort,
  session?: WorkspaceSessionController,
): WorkspaceRuntime | null {
  const status = session?.status ?? null;
  const restored = status?.kind === 'ready' ? status.restoredFolder : null;
  const sessionReady = status === null || status.kind === 'ready';
  const queryClient = useQueryClient();
  const folder = useQuery({
    ...libraryQuery(api),
    select: (snapshot) => snapshot.activeFolder,
  }).data;
  const nextGeneration = useRef(0);
  const restoredRef = useRef(restored);
  restoredRef.current = restored;
  const folderName = folder?.name ?? null;
  const folderPath = folder?.path ?? null;

  const create = useCallback(() => {
    // Only ever called for the scope the key below names, so both halves are
    // present; the fallbacks keep that promise typed rather than asserted.
    const path = folderPath ?? '';
    return createWorkspaceRuntime({
      folder: { name: folderName ?? path, path },
      generation: ++nextGeneration.current,
      queries: createWorkspaceQueryScope(queryClient, path),
      restored: restoredRef.current?.folderPath === path ? restoredRef.current : null,
    });
  }, [folderName, folderPath, queryClient]);

  const runtime = useScopedRuntime(
    folderName && folderPath && sessionReady ? `${folderPath}\u0000${folderName}` : null,
    create,
    (workspace) => workspace.dispose(),
  );

  const sessionRuntime = session?.runtime;
  useEffect(() => {
    if (!runtime || !sessionRuntime) return;
    const record = () => sessionRuntime.recordWorkspace(runtime.store.getState());
    record();
    return runtime.store.subscribe(record);
  }, [runtime, sessionRuntime]);

  return runtime;
}
