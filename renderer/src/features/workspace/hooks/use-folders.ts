import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { addFolder } from '@/features/workspace/application/add-folder';
import { openFolder } from '@/features/workspace/application/open-folder';
import type {
  FolderPickerOptions,
  LibraryApi,
  LibraryFolderPicker,
} from '@/features/workspace/application/ports';
import { libraryQueryKey } from '@/features/workspace/application/queries';

type FolderRequest =
  | { kind: 'select'; path: string }
  | { kind: 'open' }
  | { kind: 'create'; options: FolderPickerOptions };

interface FolderOperation {
  controller: AbortController;
  request: FolderRequest;
}

export function useFolders(api: LibraryApi, folderPicker: LibraryFolderPicker) {
  const queryClient = useQueryClient();
  const currentOperation = useRef<AbortController | null>(null);
  const operation = useMutation({
    mutationFn: ({ controller, request }: FolderOperation) => {
      if (request.kind === 'select') {
        return openFolder(api, request.path, controller.signal);
      }
      return addFolder(
        folderPicker,
        api,
        controller.signal,
        request.kind === 'create' ? request.options : undefined,
      );
    },
    onSettled: (_result, _error, variables) => {
      if (currentOperation.current === variables.controller) currentOperation.current = null;
    },
    onSuccess: (result) => {
      if (result.status === 'opened') {
        queryClient.setQueryData(libraryQueryKey, result.snapshot);
      }
    },
  });

  useEffect(
    () => () => {
      currentOperation.current?.abort();
    },
    [],
  );

  const run = (request: FolderRequest) => {
    currentOperation.current?.abort();
    const controller = new AbortController();
    currentOperation.current = controller;
    operation.mutate({ controller, request });
  };

  return {
    failure: operation.data?.status === 'failed' ? operation.data.message : null,
    isPending: operation.isPending,
    pendingRequest: operation.isPending ? operation.variables.request : null,
    create: (homeDirectory: string) =>
      run({ kind: 'create', options: { defaultPath: homeDirectory } }),
    open: () => run({ kind: 'open' }),
    select: (path: string) => run({ kind: 'select', path }),
  };
}
