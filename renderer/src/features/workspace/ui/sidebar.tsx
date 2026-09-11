/**
 * The Library section of the sidebar: the active folder, the chooser over the
 * folders this window may open, and the removal confirmation. Folder changes
 * are explicit and pass the document save barrier before anything is released.
 */
import { useQuery } from '@tanstack/react-query';
import {
  ChevronsUpDown,
  Folder,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  GitFork,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';

import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import type {
  GitHubImportPort,
  LibraryPort,
  LibraryFolderPickerPort,
  LibraryLifecyclePort,
} from '@/features/workspace/application/ports';
import { libraryQuery } from '@/features/workspace/application/queries';
import { displayFolderPath, folderName } from '@/features/workspace/domain/library';
import { useFolders } from '@/features/workspace/hooks/use-folders';
import { useGitHubImportDialog } from '@/features/workspace/hooks/use-github-import-dialog';
import { useRemoveFolder } from '@/features/workspace/hooks/use-remove-folder';

import { ImportGitHubDialog } from './import-github-dialog';
import { RemoveFolderDialog } from './remove-folder-dialog';

export interface LibrarySidebarProps {
  api: LibraryPort;
  /** True when preparation or search by meaning in the active folder needs the user. */
  attention?: boolean;
  beforeFolderChange?: () => Promise<boolean>;
  folderPicker: LibraryFolderPickerPort;
  githubImport: GitHubImportPort;
  lifecycle: LibraryLifecyclePort;
}

export function LibrarySidebar({
  api,
  attention = false,
  beforeFolderChange,
  folderPicker,
  githubImport,
  lifecycle,
}: LibrarySidebarProps) {
  const library = useQuery(libraryQuery(api));
  const folders = useFolders(api, folderPicker, beforeFolderChange);
  const removal = useRemoveFolder(api, lifecycle);
  const [chooserOpen, setChooserOpen] = useState(false);
  const importDialog = useGitHubImportDialog(githubImport, folders.select);
  /** Every chooser action closes the menu first: MenuItem is a plain row
   *  with no close-on-select of its own, and the switch happens in place, so
   *  a menu left standing would outlive the choice it existed for. */
  const pick = (action: () => void) => () => {
    setChooserOpen(false);
    action();
  };

  if (library.isPending) return null;

  if (library.isError) {
    return (
      <div className="px-2 py-2">
        <p className="px-2 text-caption text-destructive" role="alert">
          Library unavailable.
        </p>
        <SidebarMenu aria-label="Library recovery" className="mt-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              icon={RefreshCw}
              label="Retry"
              onClick={() => void library.refetch()}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    );
  }

  const activeFolder = library.data.activeFolder;
  if (activeFolder) {
    const activeIndex = library.data.members.findIndex(
      (member) => member.path === activeFolder.path,
    );
    const names = library.data.members.map((member) => folderName(member.path));

    return (
      <>
        {/* No extra horizontal wrap: the group's own p-2 already gives the
         *  8px pill inset every other sidebar row uses (footer, tree), and
         *  the row's stock padding then lands the folder glyph on the
         *  sidebar's shared 16px glyph column, same as the footer rows. */}
        <div>
          <SidebarMenu aria-label="Active library folder">
            <SidebarMenuItem>
              <DropdownMenu
                disabled={folders.isPending}
                onOpenChange={setChooserOpen}
                open={chooserOpen}
              >
                <DropdownTrigger
                  render={
                    // The column's head takes the active-row treatment: the
                    // standing fill and weight say "this folder", as one block
                    // with the tab strip beneath it, and a hover on it paints
                    // nothing extra. It is a switcher rather than a place the
                    // reader is at, so the current-page claim the active row
                    // would make is withheld.
                    <SidebarMenuButton
                      aria-current={undefined}
                      icon={Folder}
                      isActive
                      label={activeFolder.name}
                    >
                      {attention && (
                        <span
                          className="ml-1.5 inline-flex size-1.5 shrink-0 rounded-full bg-destructive"
                          data-folder-attention=""
                        >
                          <span className="sr-only">Needs attention</span>
                        </span>
                      )}
                      <ChevronsUpDown aria-hidden="true" className="ml-auto size-3.5 shrink-0" />
                    </SidebarMenuButton>
                  }
                />
                <DropdownContent className="w-64">
                  {library.data.members.map((member, index) => {
                    const name = folderName(member.path);
                    const duplicate = names.indexOf(name) !== names.lastIndexOf(name);
                    const path = displayFolderPath(member.path, library.data.homeDirectory);
                    return (
                      <MenuItem
                        checked={index === activeIndex}
                        icon={Folder}
                        key={member.path}
                        label={duplicate ? `${name} — ${path}` : name}
                        {...(member.path === activeFolder.path
                          ? {}
                          : { onSelect: pick(() => folders.select(member.path)) })}
                        trailingAction={{
                          icon: FolderMinus,
                          label: `Remove ${name}`,
                          onSelect: pick(() => removal.request(member.path)),
                        }}
                        title={path}
                      />
                    );
                  })}
                  <DropdownSeparator />
                  <MenuItem icon={FolderOpen} label="Open folder" onSelect={pick(folders.open)} />
                  <MenuItem
                    icon={FolderPlus}
                    label="Create folder"
                    onSelect={pick(() => folders.create(library.data.homeDirectory))}
                  />
                  <MenuItem
                    icon={GitFork}
                    label="Import from GitHub…"
                    onSelect={pick(importDialog.start)}
                  />
                </DropdownContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
          {folders.failure && (
            <p className="px-2 pt-2 text-caption text-destructive" role="alert">
              {folders.failure}
            </p>
          )}
          {removal.warning && (
            <p className="px-2 pt-2 text-caption text-muted-foreground" role="status">
              {removal.warning}
            </p>
          )}
        </div>
        <RemoveFolderDialog
          failure={removal.failure}
          folderPath={removal.target}
          homeDirectory={library.data.homeDirectory}
          pending={removal.isPending}
          onCancel={removal.cancel}
          onConfirm={removal.confirm}
        />
        <ImportGitHubDialog
          folderHome={library.data.homeDirectory}
          import={importDialog.request}
          onClose={importDialog.close}
          open={importDialog.open}
        />
      </>
    );
  }

  return null;
}
