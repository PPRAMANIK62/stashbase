import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { LibraryApi, LibraryLifecycle } from '@/features/workspace/application/ports';
import { libraryQueryKey, retireWorkspaceQueries } from '@/features/workspace/application/queries';
import { removeFolder } from '@/features/workspace/application/remove-folder';

export function useRemoveFolder(api: LibraryApi, lifecycle: LibraryLifecycle) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<string | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);
  const operation = useMutation({
    mutationFn: ({ folderPath, signal }: { folderPath: string; signal: AbortSignal }) =>
      removeFolder(api, lifecycle, folderPath, signal),
    onSuccess(result, variables) {
      if (result.status !== 'removed') return;
      void retireWorkspaceQueries(queryClient, variables.folderPath);
      queryClient.setQueryData(libraryQueryKey, result.snapshot);
      setTarget(null);
    },
    onSettled() {
      setController(null);
    },
  });

  useEffect(
    () => () => {
      controller?.abort();
    },
    [controller],
  );

  const request = (folderPath: string) => {
    if (operation.isPending) return;
    operation.reset();
    setTarget(folderPath);
  };

  const cancel = () => {
    if (operation.isPending) return;
    operation.reset();
    setTarget(null);
  };

  const confirm = () => {
    if (!target || operation.isPending) return;
    const nextController = new AbortController();
    setController(nextController);
    operation.mutate({ folderPath: target, signal: nextController.signal });
  };

  return {
    cancel,
    confirm,
    failure: operation.data?.status === 'failed' ? operation.data.message : null,
    isPending: operation.isPending,
    request,
    target,
    warning: operation.data?.status === 'removed' ? operation.data.warning : null,
  };
}
