import { useQuery } from '@tanstack/react-query';

import type { LibraryPort } from '@/features/workspace/application/ports';
import { libraryQuery } from '@/features/workspace/application/queries';

export function useLibrary(api: LibraryPort) {
  return useQuery(libraryQuery(api));
}
