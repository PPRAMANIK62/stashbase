import type { QueryClient } from '@tanstack/react-query';

import type { DocumentScope, DocumentTextSource } from '@/features/documents/domain/document';

import type { DocumentQueryScope, DocumentSourceApi } from './ports';

export const documentQueryKeys = {
  all: ['documents'] as const,
  source: (scope: DocumentScope) =>
    [
      ...documentQueryKeys.all,
      'source',
      scope.source.folderPath,
      scope.source.path,
      scope.id,
      scope.generation,
    ] as const,
};

export function createDocumentQueryScope(
  queryClient: QueryClient,
  scope: DocumentScope,
): DocumentQueryScope {
  const queryKey = documentQueryKeys.source(scope);
  return {
    cancel: () => queryClient.cancelQueries({ queryKey }),
    remove: () => queryClient.removeQueries({ queryKey }),
    replaceSource: (source: DocumentTextSource) => queryClient.setQueryData(queryKey, source),
  };
}

export function documentSourceQuery(api: DocumentSourceApi, scope: DocumentScope) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.load(scope.source, signal),
    queryKey: documentQueryKeys.source(scope),
    retry: false,
    staleTime: 0,
  } as const;
}
