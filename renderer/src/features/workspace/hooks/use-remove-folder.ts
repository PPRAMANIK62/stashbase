import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { LibraryPort, LibraryLifecyclePort } from '@/features/workspace/application/ports';
import {
  workspaceQueryKeys,
  retireWorkspaceQueries,
} from '@/features/workspace/application/queries';
import { removeFolder } from '@/features/workspace/application/remove-folder';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

export function useRemoveFolder(api: LibraryPort, lifecycle: LibraryLifecyclePort) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<string | null>(null);
  const signalFor = useRequestSignals<'remove'>();
  const operation = useMutation({
    mutationFn: ({ folderPath, signal }: { folderPath: string; signal: AbortSignal }) =>
      removeFolder(api, lifecycle, folderPath, signal),
    onSuccess(result, variables) {
      if (result.status !== 'removed') return;
      void retireWorkspaceQueries(queryClient, variables.folderPath);
      queryClient.setQueryData(workspaceQueryKeys.library, result.snapshot);
      setTarget(null);
    },
  });

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
    operation.mutate({ folderPath: target, signal: signalFor('remove') });
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
