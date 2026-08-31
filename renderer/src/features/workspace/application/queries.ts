import type { LibraryApi } from './ports';

export const libraryQueryKey = ['library', 'membership'] as const;

export function libraryQuery(api: LibraryApi) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => api.load(signal),
    queryKey: libraryQueryKey,
    retry: false,
    staleTime: 10_000,
  } as const;
}
