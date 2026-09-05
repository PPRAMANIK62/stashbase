import type { ExactSearchApi } from '@/features/retrieval/application/ports';
import type { ExactSearchRequest } from '@/features/retrieval/domain/exact-search';

export const exactSearchQueryKeys = {
  all: ['retrieval', 'exact'] as const,
  result: (request: ExactSearchRequest) =>
    [
      ...exactSearchQueryKeys.all,
      request.folderPath ?? null,
      request.query,
      request.caseSensitive,
      request.wholeWord,
    ] as const,
};

export function exactSearchQuery(api: ExactSearchApi, request: ExactSearchRequest) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.search(request, signal),
    queryKey: exactSearchQueryKeys.result(request),
    retry: false,
    staleTime: 0,
  } as const;
}
