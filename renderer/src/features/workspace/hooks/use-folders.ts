import { useMutation, useQueryClient } from '@tanstack/react-query';

import { addFolder } from '@/features/workspace/application/add-folder';
import { FOLDER_CHANGE_BLOCKED } from '@/features/workspace/application/failure-messages';
import { openFolder } from '@/features/workspace/application/open-folder';
import type {
  FolderPickerOptions,
  LibraryPort,
  LibraryFolderPickerPort,
} from '@/features/workspace/application/ports';
import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

type FolderRequest =
  | { kind: 'select'; path: string }
  | { kind: 'open' }
  | { kind: 'create'; options: FolderPickerOptions };

interface FolderOperation {
  request: FolderRequest;
  signal: AbortSignal;
}

/** Folder changes share one lane: asking for a second folder abandons the
 *  first, and the request that was abandoned is exactly the one whose signal
 *  is aborted, so a late answer can never overwrite the newer folder. */
export function useFolders(
  api: LibraryPort,
  folderPicker: LibraryFolderPickerPort,
  beforeFolderChange: () => Promise<boolean> = async () => true,
) {
  const queryClient = useQueryClient();
  const signalFor = useRequestSignals<'folder'>();
  const operation = useMutation({
    mutationFn: async ({ request, signal }: FolderOperation) => {
      if (!(await beforeFolderChange())) {
        return { status: 'failed' as const, message: FOLDER_CHANGE_BLOCKED };
      }
      if (signal.aborted) return { status: 'cancelled' as const };
      if (request.kind === 'select') {
        return openFolder(api, request.path, signal);
      }
      return addFolder(
        folderPicker,
        api,
        signal,
        request.kind === 'create' ? request.options : undefined,
      );
    },
    onSuccess: (result, variables) => {
      if (variables.signal.aborted) return;
      if (result.status === 'opened') {
        queryClient.setQueryData(workspaceQueryKeys.library, result.snapshot);
      }
    },
  });

  const run = (request: FolderRequest) => {
    operation.mutate({ request, signal: signalFor('folder') });
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
