import type { QueryClient } from '@tanstack/react-query';

import type { WorkspaceQueryScope } from './ports';
import type { LibraryApi } from './ports';

export const libraryQueryKey = ['library', 'membership'] as const;

export const workspaceQueryKeys = {
  all: ['workspace'] as const,
  folder: (folderPath: string) => ['workspace', 'folder', folderPath] as const,
};

export function libraryQuery(api: LibraryApi) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.load(signal),
    queryKey: libraryQueryKey,
    retry: false,
    staleTime: 10_000,
  } as const;
}

export function createWorkspaceQueryScope(
  queryClient: QueryClient,
  folderPath: string,
): WorkspaceQueryScope {
  const queryKey = workspaceQueryKeys.folder(folderPath);
  return {
    cancel: () => queryClient.cancelQueries({ queryKey }),
  };
}
