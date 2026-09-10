import type { QueryClient } from '@tanstack/react-query';

import type { PreparationStatusPort } from '@/features/preparation/application/ports';
import { preparationPollInterval } from '@/features/preparation/domain/readiness';

/** Nested under the workspace folder key on purpose: retiring a folder's
 *  queries cancels and drops its status poll with the listing. */
export const preparationQueryKeys = {
  folderStatus: (folderPath: string) => ['workspace', 'folder', folderPath, 'preparation'] as const,
};

/** The one place a folder's preparation status is invalidated. */
export function refreshFolderStatus(queryClient: QueryClient, folderPath: string): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: preparationQueryKeys.folderStatus(folderPath),
  });
}

export function folderStatusQuery(api: PreparationStatusPort, folderPath: string) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.load(folderPath, signal),
    queryKey: preparationQueryKeys.folderStatus(folderPath),
    refetchInterval: (query: { state: { data: Parameters<typeof preparationPollInterval>[0] } }) =>
      preparationPollInterval(query.state.data),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 0,
  } as const;
}
