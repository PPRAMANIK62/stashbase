import type { QueryClient } from '@tanstack/react-query';

import type { DocumentScope, DocumentTextSource } from '@/features/documents/domain/document';

import type {
  DocumentAssetApi,
  DocumentQueryScope,
  DocumentSourceApi,
  GenericFilePreviewApi,
} from './ports';

export const documentQueryKeys = {
  all: ['documents'] as const,
  scope: (scope: DocumentScope) =>
    [
      ...documentQueryKeys.all,
      scope.source.folderPath,
      scope.source.path,
      scope.id,
      scope.generation,
    ] as const,
  source: (scope: DocumentScope) => [...documentQueryKeys.scope(scope), 'source'] as const,
  genericPreview: (scope: DocumentScope) =>
    [...documentQueryKeys.scope(scope), 'generic-preview'] as const,
  asset: (scope: DocumentScope) => [...documentQueryKeys.scope(scope), 'asset'] as const,
};

export function createDocumentQueryScope(
  queryClient: QueryClient,
  scope: DocumentScope,
): DocumentQueryScope {
  const scopeKey = documentQueryKeys.scope(scope);
  return {
    cancel: () => queryClient.cancelQueries({ queryKey: scopeKey }),
    remove: () => queryClient.removeQueries({ queryKey: scopeKey }),
    replaceSource: (source: DocumentTextSource) =>
      queryClient.setQueryData(documentQueryKeys.source(scope), source),
  };
}

export function documentAssetQuery(api: DocumentAssetApi, scope: DocumentScope) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.load(scope.source, signal),
    queryKey: documentQueryKeys.asset(scope),
    retry: false,
    staleTime: 0,
  } as const;
}

export function documentSourceQuery(api: DocumentSourceApi, scope: DocumentScope) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.load(scope.source, signal),
    queryKey: documentQueryKeys.source(scope),
    retry: false,
    staleTime: 0,
  } as const;
}

export function genericFilePreviewQuery(api: GenericFilePreviewApi, scope: DocumentScope) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.load(scope.source, signal),
    queryKey: documentQueryKeys.genericPreview(scope),
    retry: false,
    staleTime: 0,
  } as const;
}
