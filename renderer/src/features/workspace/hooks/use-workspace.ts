import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';

import type { LibraryApi } from '@/features/workspace/application/ports';
import { createWorkspaceQueryScope, libraryQuery } from '@/features/workspace/application/queries';
import {
  createWorkspaceRuntime,
  type WorkspaceRuntime,
} from '@/features/workspace/application/runtime';
import type { FolderSessionState } from '@/features/workspace/domain/session';

export function useWorkspace(
  api: LibraryApi,
  restored: FolderSessionState | null = null,
  sessionReady = true,
): WorkspaceRuntime | null {
  const queryClient = useQueryClient();
  const folder = useQuery({
    ...libraryQuery(api),
    select: (snapshot) => snapshot.activeFolder,
  }).data;
  const nextGeneration = useRef(0);
  const [runtime, setRuntime] = useState<WorkspaceRuntime | null>(null);
  const restoredRef = useRef(restored);
  restoredRef.current = restored;
  const folderName = folder?.name ?? null;
  const folderPath = folder?.path ?? null;

  useLayoutEffect(() => {
    if (!folderName || !folderPath || !sessionReady) {
      setRuntime(null);
      return;
    }

    const nextRuntime = createWorkspaceRuntime({
      folder: { name: folderName, path: folderPath },
      generation: ++nextGeneration.current,
      queries: createWorkspaceQueryScope(queryClient, folderPath),
      restored: restoredRef.current?.folderPath === folderPath ? restoredRef.current : null,
    });
    setRuntime(nextRuntime);
    return () => nextRuntime.dispose();
  }, [folderName, folderPath, queryClient, sessionReady]);

  return folderPath && runtime?.scope.folder.path === folderPath ? runtime : null;
}
