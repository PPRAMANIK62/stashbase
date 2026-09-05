import { FolderTree, ListTree, Search } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { SidebarContent, SidebarGroup } from '@/components/ui/sidebar';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { Tooltip } from '@/components/ui/tooltip';
import { DocumentOutline, type DocumentTabsRuntime } from '@/features/documents/public';

interface SidebarNavigatorProps {
  children: ReactNode;
  onSelect(index: number): void;
  runtime: DocumentTabsRuntime | null;
  search: ReactNode;
  selectedIndex: number;
}

export function SidebarNavigator({
  children,
  onSelect,
  runtime,
  search,
  selectedIndex,
}: SidebarNavigatorProps) {
  const navigatorId = useId();

  return (
    <>
      <div className="flex shrink-0 justify-center px-4 pt-2 pb-1">
        <TabsSubtle
          aria-label="Sidebar navigator"
          iconOnly
          idPrefix={navigatorId}
          onSelect={onSelect}
          selectedIndex={selectedIndex}
          size="compact"
        >
          <Tooltip content="Files" side="bottom">
            <TabsSubtleItem icon={FolderTree} index={0} label="Files" />
          </Tooltip>
          <Tooltip content="Document outline" side="bottom">
            <TabsSubtleItem icon={ListTree} index={1} label="Document outline" />
          </Tooltip>
          <Tooltip content="Search · Cmd/Ctrl Shift F" side="bottom">
            <TabsSubtleItem
              aria-keyshortcuts="Meta+Shift+F Control+Shift+F"
              icon={Search}
              index={2}
              label="Search"
            />
          </Tooltip>
        </TabsSubtle>
      </div>

      <SidebarContent className={selectedIndex === 2 ? 'hidden' : undefined}>
        <SidebarGroup>
          <div
            aria-labelledby={`${navigatorId}-tab-0`}
            hidden={selectedIndex !== 0}
            id={`${navigatorId}-panel-0`}
            role="tabpanel"
          >
            {children}
          </div>
          <div
            aria-labelledby={`${navigatorId}-tab-1`}
            hidden={selectedIndex !== 1}
            id={`${navigatorId}-panel-1`}
            role="tabpanel"
          >
            {runtime ? (
              <DocumentOutline runtime={runtime} />
            ) : (
              <SidebarGroup aria-label="Document outline section" className="min-h-0 p-0">
                <p className="px-4 pt-1 pb-2 text-caption text-muted-foreground">
                  No outline available
                </p>
              </SidebarGroup>
            )}
          </div>
        </SidebarGroup>
      </SidebarContent>
      <div
        aria-labelledby={`${navigatorId}-tab-2`}
        className={selectedIndex === 2 ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        id={`${navigatorId}-panel-2`}
        role="tabpanel"
      >
        {search}
      </div>
    </>
  );
}
