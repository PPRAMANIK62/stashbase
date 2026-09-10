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
import { useGitHubImport } from '@/features/workspace/hooks/use-github-import';

import { ImportGitHubDialog } from './import-github-dialog';
import { useRemoveFolder } from '@/features/workspace/hooks/use-remove-folder';

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
  const [importOpen, setImportOpen] = useState(false);
  const importRequest = useGitHubImport(githubImport, {
    onImported: (path) => {
      setImportOpen(false);
      // The published folder is opened through the same lane every other
      // folder change uses, so the save barrier and abandonment rules apply.
      folders.select(path);
    },
  });

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
        <div className="px-2">
          <SidebarMenu aria-label="Active library folder">
            <SidebarMenuItem>
              <DropdownMenu
                disabled={folders.isPending}
                onOpenChange={setChooserOpen}
                open={chooserOpen}
              >
                <DropdownTrigger
                  render={
                    <SidebarMenuButton icon={Folder} isActive label={activeFolder.name}>
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
                          : { onSelect: () => folders.select(member.path) })}
                        trailingAction={{
                          icon: FolderMinus,
                          label: `Remove ${name} from Library`,
                          onSelect: () => {
                            setChooserOpen(false);
                            removal.request(member.path);
                          },
                        }}
                        title={path}
                      />
                    );
                  })}
                  <DropdownSeparator />
                  <MenuItem icon={FolderOpen} label="Open folder" onSelect={folders.open} />
                  <MenuItem
                    icon={FolderPlus}
                    label="Create folder"
                    onSelect={() => folders.create(library.data.homeDirectory)}
                  />
                  <MenuItem
                    icon={GitFork}
                    label="Import from GitHub…"
                    onSelect={() => {
                      setChooserOpen(false);
                      setImportOpen(true);
                    }}
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
          import={importRequest}
          onClose={() => setImportOpen(false)}
          open={importOpen}
        />
      </>
    );
  }

  return null;
}
