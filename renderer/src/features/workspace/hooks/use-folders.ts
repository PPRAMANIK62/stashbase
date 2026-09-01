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
  generation: number;
  request: FolderRequest;
}

interface CurrentFolderOperation {
  controller: AbortController;
  generation: number;
}

export function useFolders(api: LibraryApi, folderPicker: LibraryFolderPicker) {
  const queryClient = useQueryClient();
  const currentOperation = useRef<CurrentFolderOperation | null>(null);
  const nextGeneration = useRef(0);
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
      if (
        currentOperation.current?.controller === variables.controller &&
        currentOperation.current.generation === variables.generation
      ) {
        currentOperation.current = null;
      }
    },
    onSuccess: (result, variables) => {
      const current = currentOperation.current;
      if (
        !current ||
        current.controller !== variables.controller ||
        current.generation !== variables.generation ||
        variables.controller.signal.aborted
      ) {
        return;
      }
      if (result.status === 'opened') {
        queryClient.setQueryData(libraryQueryKey, result.snapshot);
      }
    },
  });

  useEffect(
    () => () => {
      currentOperation.current?.controller.abort();
    },
    [],
  );

  const run = (request: FolderRequest) => {
    currentOperation.current?.controller.abort();
    const controller = new AbortController();
    const generation = ++nextGeneration.current;
    currentOperation.current = { controller, generation };
    operation.mutate({ controller, generation, request });
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
