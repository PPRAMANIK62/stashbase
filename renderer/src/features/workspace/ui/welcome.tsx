import { useQuery } from '@tanstack/react-query';
import { Folder, FolderOpen, FolderPlus, LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { LibraryApi, LibraryFolderPicker } from '@/features/workspace/application/ports';
import { libraryQuery } from '@/features/workspace/application/queries';
import { displayFolderPath, folderName } from '@/features/workspace/domain/library';
import { useFolders } from '@/features/workspace/hooks/use-folders';
import { Logo } from '@/shared/brand/logo';

export interface LibraryWelcomeProps {
  api: LibraryApi;
  folderPicker: LibraryFolderPicker;
  isRestoringSession?: boolean;
}

export function LibraryWelcome({
  api,
  folderPicker,
  isRestoringSession = false,
}: LibraryWelcomeProps) {
  const library = useQuery(libraryQuery(api));
  const folders = useFolders(api, folderPicker);

  if (!library.data || library.data.activeFolder || isRestoringSession) return null;

  const hasMembers = library.data.members.length > 0;
  const creating = folders.pendingRequest?.kind === 'create';
  const opening = folders.pendingRequest?.kind === 'open';

  return (
    <div className="flex h-full items-center justify-center px-6 pb-11">
      <main className="flex w-full max-w-md flex-col items-center text-center">
        <Logo aria-hidden="true" className="mb-5 size-16" />
        <h1 className="text-display font-semibold tracking-tight">StashBase</h1>
        <p className="mt-2 max-w-sm text-body leading-relaxed text-muted-foreground">
          Turn your local files into Agent-ready context without moving them out of your folders.
        </p>

        <div aria-hidden="true" className="my-7 h-px w-10 bg-border" />

        <h2 className="text-title font-medium">
          {hasMembers ? 'Choose a folder' : 'Choose a folder to begin'}
        </h2>
        {!hasMembers && (
          <p className="mt-2 max-w-xs text-body leading-relaxed text-muted-foreground">
            Open a folder you already use, or create a new one.
          </p>
        )}

        {hasMembers && (
          <ul
            aria-label="Library folders"
            className="mt-4 flex max-h-56 w-full max-w-sm flex-col gap-1 overflow-y-auto p-1"
          >
            {library.data.members.map((member) => {
              const isOpening =
                folders.pendingRequest?.kind === 'select' &&
                folders.pendingRequest.path === member.path;
              return (
                <li key={member.path}>
                  <button
                    className="group flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left transition-colors duration-80 outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] disabled:pointer-events-none disabled:opacity-50"
                    disabled={folders.isPending}
                    onClick={() => folders.select(member.path)}
                    title={member.path}
                    type="button"
                  >
                    <Folder
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition-[color,stroke-width] duration-80 group-hover:stroke-2 group-hover:text-foreground"
                      strokeWidth={1.5}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium">
                        {folderName(member.path)}
                      </span>
                      <span className="mt-0.5 block truncate text-caption text-muted-foreground">
                        {displayFolderPath(member.path, library.data.homeDirectory)}
                      </span>
                    </span>
                    {isOpening && (
                      <LoaderCircle
                        aria-label="Opening"
                        className="size-3.5 shrink-0 motion-safe:animate-spin"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex items-center gap-2">
          <Button
            disabled={folders.isPending}
            loading={folders.isPending && opening}
            leadingIcon={FolderOpen}
            onClick={folders.open}
          >
            Open folder
          </Button>
          <Button
            disabled={folders.isPending}
            loading={folders.isPending && creating}
            leadingIcon={FolderPlus}
            onClick={() => folders.create(library.data.homeDirectory)}
            variant="tertiary"
          >
            Create folder
          </Button>
        </div>
        {folders.failure && (
          <p className="mt-3 text-caption text-destructive" role="alert">
            {folders.failure}
          </p>
        )}
      </main>
    </div>
  );
}
