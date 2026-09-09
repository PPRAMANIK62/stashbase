import type { PreparationStatusApi } from '@/features/preparation/application/ports';
import { preparationPollInterval } from '@/features/preparation/domain/readiness';

/** Nested under the workspace folder key on purpose: retiring a folder's
 *  queries cancels and drops its status poll with the listing. */
export const folderStatusQueryKey = (folderPath: string) =>
  ['workspace', 'folder', folderPath, 'preparation'] as const;

export function folderStatusQuery(api: PreparationStatusApi, folderPath: string) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.load(folderPath, signal),
    queryKey: folderStatusQueryKey(folderPath),
    refetchInterval: (query: { state: { data: Parameters<typeof preparationPollInterval>[0] } }) =>
      preparationPollInterval(query.state.data),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 0,
  } as const;
}
