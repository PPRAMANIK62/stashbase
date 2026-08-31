import { useQuery } from '@tanstack/react-query';
import { Folder, RefreshCw } from 'lucide-react';

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import type { LibraryApi } from '@/features/workspace/application/ports';
import { libraryQuery } from '@/features/workspace/application/queries';

export interface LibrarySidebarProps {
  api: LibraryApi;
}

export function LibrarySidebar({ api }: LibrarySidebarProps) {
  const library = useQuery(libraryQuery(api));

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
    return (
      <SidebarMenu aria-label="Active library folder" className="px-2">
        <SidebarMenuItem>
          <SidebarMenuButton icon={Folder} isActive>
            {activeFolder.name}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return null;
}
