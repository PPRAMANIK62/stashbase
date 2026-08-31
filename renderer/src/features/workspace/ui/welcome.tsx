import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, FolderPlus } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { addFolder } from '@/features/workspace/application/add-folder';
import type {
  FolderPickerOptions,
  LibraryApi,
  LibraryFolderPicker,
} from '@/features/workspace/application/ports';
import { libraryQuery, libraryQueryKey } from '@/features/workspace/application/queries';
import { Logo } from '@/shared/brand/logo';

export interface LibraryWelcomeProps {
  api: LibraryApi;
  folderPicker: LibraryFolderPicker;
}

export function LibraryWelcome({ api, folderPicker }: LibraryWelcomeProps) {
  const queryClient = useQueryClient();
  const library = useQuery(libraryQuery(api));
  const operation = useRef<AbortController | null>(null);
  const authorization = useMutation({
    mutationFn: ({ options, signal }: { options?: FolderPickerOptions; signal: AbortSignal }) =>
      addFolder(folderPicker, api, signal, options),
    onSettled: () => {
      operation.current = null;
    },
    onSuccess: (result) => {
      if (result.status === 'opened') {
        queryClient.setQueryData(libraryQueryKey, result.snapshot);
      }
    },
  });

  useEffect(
    () => () => {
      operation.current?.abort();
    },
    [],
  );

  const beginAuthorization = (options?: FolderPickerOptions) => {
    operation.current?.abort();
    operation.current = new AbortController();
    authorization.mutate({ options, signal: operation.current.signal });
  };

  if (!library.data || library.data.activeFolder) return null;

  const failure = authorization.data?.status === 'failed' ? authorization.data.message : null;
  const creating =
    authorization.isPending && authorization.variables.options?.defaultPath !== undefined;

  return (
    <div className="flex h-full items-center justify-center px-6 pb-11">
      <main className="flex w-full max-w-md flex-col items-center text-center">
        <Logo aria-hidden="true" className="mb-5 size-16" />
        <h1 className="text-display font-semibold tracking-tight">StashBase</h1>
        <p className="mt-2 max-w-sm text-body leading-relaxed text-muted-foreground">
          Turn your local files into Agent-ready context without moving them out of your folders.
        </p>

        <div aria-hidden="true" className="my-7 h-px w-10 bg-border" />

        <h2 className="text-title font-medium">Choose a folder to begin</h2>
        <p className="mt-2 max-w-xs text-body leading-relaxed text-muted-foreground">
          Open a folder you already use, or create a new one.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <Button
            loading={authorization.isPending && !creating}
            leadingIcon={FolderOpen}
            onClick={() => beginAuthorization()}
          >
            Open folder
          </Button>
          <Button
            loading={creating}
            leadingIcon={FolderPlus}
            onClick={() => beginAuthorization({ defaultPath: library.data.homeDirectory })}
            variant="tertiary"
          >
            Create folder
          </Button>
        </div>
        {failure && (
          <p className="mt-3 text-caption text-destructive" role="alert">
            {failure}
          </p>
        )}
      </main>
    </div>
  );
}
