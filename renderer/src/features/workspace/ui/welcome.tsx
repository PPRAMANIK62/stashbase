/** What a window shows before any folder is open: the library's recent
 *  folders, the three ways to add one, and the Gallery band the caller
 *  composes in. */
import { useQuery } from '@tanstack/react-query';
import { Folder, FolderMinus, LoaderCircle, MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import type {
  GitHubImportPort,
  LibraryFolderPickerPort,
  LibraryLifecyclePort,
  LibraryPort,
} from '@/features/workspace/application/ports';
import { libraryQuery } from '@/features/workspace/application/queries';
import {
  displayFolderPath,
  folderName,
  isTemporaryFolderPath,
  parentFolderPath,
} from '@/features/workspace/domain/library';
import { useFolders } from '@/features/workspace/hooks/use-folders';
import { useGitHubImportDialog } from '@/features/workspace/hooks/use-github-import-dialog';
import { useRemoveFolder } from '@/features/workspace/hooks/use-remove-folder';
import { focusRing } from '@/lib/focus-ring';
import { cn } from '@/lib/utils';
import { Logo } from '@/shared/brand/logo';

import { ImportGitHubDialog } from './import-github-dialog';
import { RemoveFolderDialog } from './remove-folder-dialog';

export interface LibraryWelcomeProps {
  api: LibraryPort;
  folderPicker: LibraryFolderPickerPort;
  /** The Gallery band. Composed rather than owned here: the shop is its own
   *  feature, and this screen is only one of the two ways in. */
  gallery?: ReactNode;
  githubImport: GitHubImportPort;
  isRestoringSession?: boolean;
  lifecycle: LibraryLifecyclePort;
}

/** The menu a recent row shows on hover. It is a sibling of the row rather
 *  than a child, because the row is itself a button and a button cannot hold
 *  another. */
function RecentFolderActions({
  disabled,
  name,
  onRemove,
}: {
  disabled: boolean;
  name: string;
  onRemove(): void;
}) {
  return (
    <DropdownMenu disabled={disabled}>
      <DropdownTrigger
        render={
          <Button
            aria-label={`Actions for ${name}`}
            className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 transition-opacity duration-fast group-focus-within:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100"
            size="icon-compact"
            variant="ghost"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        }
      />
      <DropdownContent align="end" className="w-52">
        <MenuItem
          className="text-destructive"
          icon={FolderMinus}
          label="Remove from Library"
          onSelect={onRemove}
        />
      </DropdownContent>
    </DropdownMenu>
  );
}

export function LibraryWelcome({
  api,
  folderPicker,
  gallery,
  githubImport,
  isRestoringSession = false,
  lifecycle,
}: LibraryWelcomeProps) {
  const library = useQuery(libraryQuery(api));
  const folders = useFolders(api, folderPicker);
  const removal = useRemoveFolder(api, lifecycle);
  const importDialog = useGitHubImportDialog(githubImport, folders.select);

  if (!library.data || library.data.activeFolder || isRestoringSession) return null;

  const { homeDirectory } = library.data;
  // The list is a memory of the places the reader works, so the scratch
  // directories a smoke test or an import registers stay out of it. They
  // remain members, and the sidebar's chooser still lists them.
  const recent = library.data.members.filter((member) => !isTemporaryFolderPath(member.path));
  const creating = folders.pendingRequest?.kind === 'create';
  const opening = folders.pendingRequest?.kind === 'open';

  // Each button is one verb; the row's text says what the verb acts on. The
  // accessible name keeps the object, because a button read on its own has
  // no row beside it.
  const ways = [
    {
      action: (
        <Button
          aria-label="Open folder as a project"
          className="w-24 shrink-0"
          disabled={folders.isPending}
          loading={folders.isPending && opening}
          onClick={folders.open}
        >
          Open
        </Button>
      ),
      detail: 'Point StashBase at your folder. Files stay where they are.',
      title: 'Open folder as a project',
    },
    {
      action: (
        <Button
          aria-label="Create a new project"
          className="w-24 shrink-0"
          disabled={folders.isPending}
          loading={folders.isPending && creating}
          onClick={() => folders.create(homeDirectory)}
          variant="tertiary"
        >
          Create
        </Button>
      ),
      detail: 'Make an empty folder and open it as a project.',
      title: 'Create a new project',
    },
    {
      action: (
        <Button
          aria-label="Import project from GitHub"
          className="w-24 shrink-0"
          disabled={folders.isPending}
          onClick={importDialog.start}
          variant="tertiary"
        >
          Import
        </Button>
      ),
      detail: 'Clone a public repository into a new project.',
      title: 'Import project from GitHub',
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-11">
      <main className="@container my-auto flex w-full flex-col items-center">
        {/* The mark is a lockup, not a paragraph: name on one line, tagline
         * on one line. The measure is wide enough for the tagline to stay
         * single at the default size, so a centered two-line block never
         * argues with the hard left edge below it. */}
        <div className="flex w-full max-w-2xl flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <Logo aria-hidden="true" className="size-10" />
            <h1 className="text-display font-semibold tracking-tight">StashBase</h1>
          </div>
          <p className="mt-3 text-body leading-relaxed text-muted-foreground">
            Turn your local files into a wiki, then write with Claude Code and Codex using your own
            sources.
          </p>
        </div>

        {/* Everything under the mark shares one measure, one left edge, and
         * one grid: the ways in, the recent list, and the shelf. Only the
         * mark stays centered, because it is a mark rather than a column.
         * The two cards are equal halves with the shelf's own gutter, so
         * their outer and inner edges land on the shelf's column lines
         * below; any other split leaves the screen with two grids. The card
         * leads: left of the list once the pane can hold both without the
         * card's rows stacking, above the list when it cannot. The two
         * columns share one height, so the card's rows spread to meet the
         * foot of the list's frame rather than leaving the card hanging
         * short beside it. The pane is what is measured, not the window: a
         * sidebar takes its share before this screen sees any width. */}
        <section aria-label="Choose a folder" className="mt-10 w-full max-w-5xl">
          <div className="grid grid-cols-1 gap-6 @min-[44rem]:grid-cols-2">
            {/* Rules run edge to edge, as they do in every framed list in the
             * app, so the inset lives on the rows rather than the frame. */}
            <ul
              aria-label="Add a folder"
              className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface-2 shadow-surface-2"
            >
              {ways.map((way) => (
                <li className="flex flex-1 items-center gap-4 px-4 py-3.5" key={way.title}>
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium">{way.title}</p>
                    <p className="mt-0.5 text-caption leading-snug text-muted-foreground">
                      {way.detail}
                    </p>
                  </div>
                  {way.action}
                </li>
              ))}
            </ul>

            {/* The list gets a frame of its own, the same paper and hairline
             * as the card beside it, so the column's weight is the box and
             * not however long the reader's paths happen to be: a short path
             * no longer leaves the right half empty, and a long one truncates
             * at the frame instead of running off. */}
            <div className="flex min-w-0 flex-col rounded-xl border border-border bg-surface-2 shadow-surface-2">
              <h2 className="border-b border-border px-4 py-3 text-body font-medium">Recent</h2>
              {recent.length > 0 ? (
                /* Five 3rem rows plus the ring padding, so the list ends on a
                 * whole row, and a half-row fade at its foot says the rest
                 * scrolls without smudging the last row the reader can see. */
                <ul
                  aria-label="Recent folders"
                  className="scroll-fade max-h-[15.5rem] overflow-y-auto p-1 [--scroll-fade-size:1.5rem]"
                >
                  {recent.map((member) => {
                    const name = folderName(member.path);
                    const isOpening =
                      folders.pendingRequest?.kind === 'select' &&
                      folders.pendingRequest.path === member.path;
                    return (
                      <li className="group relative" key={member.path}>
                        <button
                          className={cn(
                            'flex h-12 w-full cursor-pointer items-center gap-3 rounded-lg pr-12 pl-3 text-left transition-colors duration-fast outline-none hover:bg-hover disabled:pointer-events-none disabled:opacity-50',
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
                            <span className="block truncate text-body font-medium">{name}</span>
                            {/* The row already says the folder's name, so the
                             * path stops at the directory it sits in. */}
                            <span className="mt-0.5 block truncate text-caption text-muted-foreground">
                              {displayFolderPath(parentFolderPath(member.path), homeDirectory)}
                            </span>
                          </span>
                          {isOpening && (
                            <LoaderCircle
                              aria-label="Opening"
                              className="size-3.5 shrink-0 motion-safe:animate-spin"
                            />
                          )}
                        </button>
                        <RecentFolderActions
                          disabled={folders.isPending || removal.isPending}
                          name={name}
                          onRemove={() => removal.request(member.path)}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-3 text-body leading-relaxed text-muted-foreground">
                  Folders you open will be listed here.
                </p>
              )}
            </div>
          </div>
          {folders.failure && (
            <p className="mt-3 text-caption text-destructive" role="alert">
              {folders.failure}
            </p>
          )}
          {removal.warning && (
            <p className="mt-3 text-caption text-muted-foreground" role="status">
              {removal.warning}
            </p>
          )}
        </section>

        {gallery && (
          <section className="mt-10 w-full max-w-5xl">
            <h2 className="text-title font-medium">Or start from a project in the Gallery</h2>
            <p className="mt-1 max-w-lg text-body leading-relaxed text-muted-foreground">
              Real folders, already organized into a wiki. Make a copy and build on it.
            </p>
            <div className="mt-4">{gallery}</div>
          </section>
        )}
      </main>
      <ImportGitHubDialog
        folderHome={homeDirectory}
        import={importDialog.request}
        onClose={importDialog.close}
        open={importDialog.open}
      />
      <RemoveFolderDialog
        failure={removal.failure}
        folderPath={removal.target}
        homeDirectory={homeDirectory}
        onCancel={removal.cancel}
        onConfirm={removal.confirm}
        pending={removal.isPending}
      />
    </div>
  );
}
