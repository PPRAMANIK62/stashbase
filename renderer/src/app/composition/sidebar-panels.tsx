import { Bot, FolderTree, ListTree, Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { SidebarGroup } from '@/components/ui/sidebar';
import { DocumentOutline, type DocumentTabsRuntime } from '@/features/documents/public';
import type { IconComponent } from '@/lib/icon-context';

import type { SidebarPanelId } from './use-workspace-commands';

export interface SidebarPanel {
  /** True when the panel takes the whole column instead of sitting inside the
   *  scrolling tree region. */
  hidesTree: boolean;
  icon: IconComponent;
  id: SidebarPanelId;
  /** Shortcut announced on the tab, when the panel has one. */
  keyshortcuts?: string;
  label: string;
  /** What the tab's tooltip says; defaults to the label. */
  hint?: string;
  /** `active` is true only for the selected panel, so a panel that is
   *  expensive to mount can stay unmounted until it is asked for. */
  render(active: boolean): ReactNode;
}

export interface SidebarPanelSources {
  chats: ReactNode;
  files: ReactNode;
  outline: DocumentTabsRuntime | null;
  search: ReactNode;
}

/**
 * The sidebar's panels, in tab order.
 *
 * This list is the whole definition of the navigator: adding a panel is one
 * entry here, and nothing downstream counts tabs or compares indices. Files and
 * Document outline share the scrolling tree region; Search and Chats replace
 * it, which is what `hidesTree` says.
 */
export function sidebarPanels({
  chats,
  files,
  outline,
  search,
}: SidebarPanelSources): SidebarPanel[] {
  return [
    {
      hidesTree: false,
      icon: FolderTree,
      id: 'files',
      label: 'Files',
      render: () => files,
    },
    {
      hidesTree: false,
      icon: ListTree,
      id: 'outline',
      label: 'Document outline',
      render: () => (outline ? <DocumentOutline runtime={outline} /> : <NoOutline />),
    },
    {
      hidesTree: true,
      hint: 'Search · Cmd/Ctrl Shift F',
      icon: Search,
      id: 'search',
      keyshortcuts: 'Meta+Shift+F Control+Shift+F',
      label: 'Search',
      render: () => search,
    },
    {
      hidesTree: true,
      icon: Bot,
      id: 'chats',
      label: 'Chats',
      render: (active) => (active ? chats : null),
    },
  ];
}

function NoOutline() {
  return (
    <SidebarGroup aria-label="Document outline section" className="min-h-0 p-0">
      <p className="px-4 pt-1 pb-2 text-caption text-muted-foreground">No outline available</p>
    </SidebarGroup>
  );
}
