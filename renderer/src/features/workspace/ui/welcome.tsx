import { useQuery } from '@tanstack/react-query';
import { Folder, FolderOpen, FolderPlus, GitFork, LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import type {
  GitHubImportPort,
  LibraryPort,
  LibraryFolderPickerPort,
} from '@/features/workspace/application/ports';
import { libraryQuery } from '@/features/workspace/application/queries';
import { displayFolderPath, folderName } from '@/features/workspace/domain/library';
import { useFolders } from '@/features/workspace/hooks/use-folders';
import { useGitHubImport } from '@/features/workspace/hooks/use-github-import';
import { focusRing } from '@/lib/focus-ring';

import { ImportGitHubDialog } from './import-github-dialog';
import { cn } from '@/lib/utils';
import { Logo } from '@/shared/brand/logo';

export interface LibraryWelcomeProps {
  api: LibraryPort;
  folderPicker: LibraryFolderPickerPort;
  /** The Gallery band. Composed rather than owned here: the shop is its own
   *  feature, and this screen is only one of the two ways in. */
  gallery?: ReactNode;
  githubImport: GitHubImportPort;
  isRestoringSession?: boolean;
}

export function LibraryWelcome({
  api,
  folderPicker,
  gallery,
  githubImport,
  isRestoringSession = false,
}: LibraryWelcomeProps) {
  const library = useQuery(libraryQuery(api));
  const folders = useFolders(api, folderPicker);
  const [importOpen, setImportOpen] = useState(false);
  const importRequest = useGitHubImport(githubImport, {
    onImported: (path) => {
      setImportOpen(false);
      folders.select(path);
    },
  });

  if (!library.data || library.data.activeFolder || isRestoringSession) return null;

  const hasMembers = library.data.members.length > 0;
  const creating = folders.pendingRequest?.kind === 'create';
  const opening = folders.pendingRequest?.kind === 'open';

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-11">
      <main className="my-auto flex w-full flex-col items-center">
        <div className="flex w-full max-w-lg flex-col items-center text-center">
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
                      className={cn(
                        'group flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left transition-colors duration-fast outline-none hover:bg-hover disabled:pointer-events-none disabled:opacity-50',
                        focusRing(),
                      )}
                      disabled={folders.isPending}
                      onClick={() => folders.select(member.path)}
                      title={member.path}
                      type="button"
                    >
                      <Folder
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground transition-[color,stroke-width] duration-fast group-hover:stroke-2 group-hover:text-foreground"
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

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
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
            <Button
              disabled={folders.isPending}
              leadingIcon={GitFork}
              onClick={() => setImportOpen(true)}
              variant="tertiary"
            >
              Import from GitHub
            </Button>
          </div>
          <ImportGitHubDialog
            folderHome={library.data.homeDirectory}
            import={importRequest}
            onClose={() => setImportOpen(false)}
            open={importOpen}
          />
          {folders.failure && (
            <p className="mt-3 text-caption text-destructive" role="alert">
              {folders.failure}
            </p>
          )}
        </div>
        {/* The shelf takes a wider measure than the hero above it, but its
          * heading keeps the hero's center axis: two competing alignments on
          * one screen read as two screens. */}
        {gallery && (
          <section className="mt-7 flex w-full max-w-5xl flex-col items-center">
            <div aria-hidden="true" className="mb-7 h-px w-10 bg-border" />
            <h2 className="text-title font-medium">Or start from a ready-made Wiki</h2>
            <p className="mt-2 max-w-sm text-center text-body leading-relaxed text-muted-foreground">
              Real folders with a wiki already built from them. A copy opens in its own window.
            </p>
            <div className="mt-6 w-full">{gallery}</div>
          </section>
        )}
      </main>
    </div>
  );
}
