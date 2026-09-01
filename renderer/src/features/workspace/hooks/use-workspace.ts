import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';

import type { LibraryApi } from '@/features/workspace/application/ports';
import { createWorkspaceQueryScope, libraryQuery } from '@/features/workspace/application/queries';
import {
  createWorkspaceRuntime,
  type WorkspaceRuntime,
} from '@/features/workspace/application/runtime';

export function useWorkspace(api: LibraryApi): WorkspaceRuntime | null {
  const queryClient = useQueryClient();
  const folder = useQuery({
    ...libraryQuery(api),
    select: (snapshot) => snapshot.activeFolder,
  }).data;
  const nextGeneration = useRef(0);
  const [runtime, setRuntime] = useState<WorkspaceRuntime | null>(null);
  const folderName = folder?.name ?? null;
  const folderPath = folder?.path ?? null;

  useLayoutEffect(() => {
    if (!folderName || !folderPath) {
      setRuntime(null);
      return;
    }

    const nextRuntime = createWorkspaceRuntime({
      folder: { name: folderName, path: folderPath },
      generation: ++nextGeneration.current,
      queries: createWorkspaceQueryScope(queryClient, folderPath),
    });
    setRuntime(nextRuntime);
    return () => nextRuntime.dispose();
  }, [folderName, folderPath, queryClient]);

  return folderPath && runtime?.scope.folder.path === folderPath ? runtime : null;
}
