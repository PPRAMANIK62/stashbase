import { useQuery } from '@tanstack/react-query';

import type { LibraryApi } from '@/features/workspace/application/ports';
import { libraryQuery } from '@/features/workspace/application/queries';

export function useLibrary(api: LibraryApi) {
  return useQuery(libraryQuery(api));
}
