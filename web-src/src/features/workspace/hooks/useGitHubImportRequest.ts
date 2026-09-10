import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/common/api/api';

/** Own the cancellable transport lifecycle behind the import dialog. */
export function useGitHubImportRequest() {
  const controllerRef = useRef<AbortController | null>(null);

  const cancelImport = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  useEffect(() => cancelImport, [cancelImport]);

  const importRepository = useCallback(async (input: { url: string; folderName: string }) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      return await api.importPublicGitHubRepository(input, { signal: controller.signal });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  return {
    cancelImport,
    getFolderHome: api.getFolderHome,
    importRepository,
  };
}
