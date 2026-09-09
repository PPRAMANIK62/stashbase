import type { ExactSearchRequest } from '@/features/retrieval/domain/exact-search';
import type { SemanticSearchRequest } from '@/features/retrieval/domain/semantic-search';

/** Every retrieval query hangs off `all`, so cancelling it stops whatever a
 *  search backend has in flight without naming the backend. */
export const retrievalQueryKeys = {
  all: ['retrieval'] as const,
  exact: (request: ExactSearchRequest): readonly unknown[] => [
    ...retrievalQueryKeys.all,
    'exact',
    request.folderPath ?? null,
    request.query,
    request.caseSensitive,
    request.wholeWord,
  ],
  semantic: (request: SemanticSearchRequest): readonly unknown[] => [
    ...retrievalQueryKeys.all,
    'semantic',
    request.folderPath ?? null,
    request.query,
    request.topK,
  ],
};
