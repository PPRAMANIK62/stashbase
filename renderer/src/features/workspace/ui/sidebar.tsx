import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Folder, FolderOpen, FolderPlus, RefreshCw } from 'lucide-react';

import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import type { LibraryApi, LibraryFolderPicker } from '@/features/workspace/application/ports';
import { libraryQuery } from '@/features/workspace/application/queries';
import { displayFolderPath, folderName } from '@/features/workspace/domain/library';
import { useFolders } from '@/features/workspace/hooks/use-folders';

export interface LibrarySidebarProps {
  api: LibraryApi;
  folderPicker: LibraryFolderPicker;
}

export function LibrarySidebar({ api, folderPicker }: LibrarySidebarProps) {
  const library = useQuery(libraryQuery(api));
  const folders = useFolders(api, folderPicker);

  if (library.isPending) return null;

  if (library.isError) {
    return (
      <div className="px-2 py-2">
        <p className="px-2 text-caption text-destructive" role="alert">
          Library unavailable.
        </p>
        <SidebarMenu aria-label="Library recovery" className="mt-1">
          <SidebarMenuItem>
            <SidebarMenuButton icon={RefreshCw} onClick={() => void library.refetch()}>
              Retry
            </SidebarMenuButton>
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
      <div className="px-2">
        <SidebarMenu aria-label="Active library folder">
          <SidebarMenuItem>
            <DropdownMenu disabled={folders.isPending}>
              <DropdownTrigger
                render={
                  <SidebarMenuButton icon={Folder} isActive>
                    {activeFolder.name}
                    <ChevronsUpDown aria-hidden="true" className="ml-auto size-3.5 shrink-0" />
                  </SidebarMenuButton>
                }
              />
              <DropdownContent
                checkedIndex={activeIndex >= 0 ? activeIndex : undefined}
                className="w-64"
              >
                {library.data.members.map((member, index) => {
                  const name = names[index];
                  const duplicate = names.indexOf(name) !== names.lastIndexOf(name);
                  const path = displayFolderPath(member.path, library.data.homeDirectory);
                  return (
                    <MenuItem
                      checked={index === activeIndex}
                      icon={Folder}
                      index={index}
                      key={member.path}
                      label={duplicate ? `${name} — ${path}` : name}
                      onSelect={
                        member.path === activeFolder.path
                          ? undefined
                          : () => folders.select(member.path)
                      }
                      title={path}
                    />
                  );
                })}
                <DropdownSeparator />
                <MenuItem
                  icon={FolderOpen}
                  index={library.data.members.length}
                  label="Open folder"
                  onSelect={folders.open}
                />
                <MenuItem
                  icon={FolderPlus}
                  index={library.data.members.length + 1}
                  label="Create folder"
                  onSelect={() => folders.create(library.data.homeDirectory)}
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
      </div>
    );
  }

  return null;
}
