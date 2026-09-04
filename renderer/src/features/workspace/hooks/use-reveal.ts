import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { FilesApi } from '@/features/workspace/application/ports';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';

interface RevealOperation {
  controller: AbortController;
  path: string;
}

export function useReveal(runtime: WorkspaceRuntime, api: FilesApi) {
  const current = useRef<AbortController | null>(null);
  const operation = useMutation({
    mutationFn: ({ controller, path }: RevealOperation) =>
      api.reveal(runtime.scope.folder.path, path, controller.signal),
    onSettled: (_result, _error, variables) => {
      if (current.current === variables.controller) current.current = null;
    },
  });

  useEffect(() => {
    const abort = () => current.current?.abort();
    runtime.signal.addEventListener('abort', abort);
    return () => {
      runtime.signal.removeEventListener('abort', abort);
      abort();
    };
  }, [runtime]);

  return {
    error: operation.isError ? 'The item could not be shown.' : null,
    async reveal(path: string): Promise<boolean> {
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      try {
        await operation.mutateAsync({ controller, path });
        return true;
      } catch {
        return false;
      }
    },
  };
}
