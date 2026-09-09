import type { ExactSearchApi, SemanticSearchApi } from '@/features/retrieval/application/ports';
import type { ExactSearchRequest } from '@/features/retrieval/domain/exact-search';
import type { SemanticSearchRequest } from '@/features/retrieval/domain/semantic-search';

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

export const semanticSearchQueryKeys = {
  all: ['retrieval', 'semantic'] as const,
  result: (request: SemanticSearchRequest) =>
    [
      ...semanticSearchQueryKeys.all,
      request.folderPath ?? null,
      request.query,
      request.topK,
    ] as const,
};

export function semanticSearchQuery(api: SemanticSearchApi, request: SemanticSearchRequest) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.search(request, signal),
    queryKey: semanticSearchQueryKeys.result(request),
    retry: false,
    staleTime: 0,
  } as const;
}
