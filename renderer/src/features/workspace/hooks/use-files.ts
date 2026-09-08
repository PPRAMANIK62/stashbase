import { useQuery } from '@tanstack/react-query';

import type { FilesApi } from '@/features/workspace/application/ports';
import { filesQuery } from '@/features/workspace/application/queries';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';

export function useFiles(runtime: WorkspaceRuntime | null, api: FilesApi) {
  return useQuery({
    ...filesQuery(api, runtime?.scope.folder.path ?? ''),
    enabled: runtime !== null,
  });
}
