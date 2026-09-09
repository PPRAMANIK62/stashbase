import { useQuery } from '@tanstack/react-query';

import type { PreparationStatusApi } from '@/features/preparation/application/ports';
import { folderStatusQuery } from '@/features/preparation/application/queries';

const idleFolder = '';

/** Polls one folder's preparation and AI Index snapshot while the folder is open. */
export function useFolderStatus(api: PreparationStatusApi, folderPath: string | null) {
  return useQuery({
    ...folderStatusQuery(api, folderPath ?? idleFolder),
    enabled: folderPath !== null,
  });
}
