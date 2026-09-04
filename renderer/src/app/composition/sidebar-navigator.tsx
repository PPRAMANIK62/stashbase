import { FolderTree, ListTree } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { SidebarContent, SidebarGroup } from '@/components/ui/sidebar';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { Tooltip } from '@/components/ui/tooltip';
import { DocumentOutline, type DocumentTabsRuntime } from '@/features/documents/public';

interface SidebarNavigatorProps {
  children: ReactNode;
  runtime: DocumentTabsRuntime | null;
}

export function SidebarNavigator({ children, runtime }: SidebarNavigatorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigatorId = useId();

  return (
    <>
      <div className="flex shrink-0 justify-center px-4 pt-2 pb-1">
        <TabsSubtle
          aria-label="Sidebar navigator"
          iconOnly
          idPrefix={navigatorId}
          onSelect={setSelectedIndex}
          selectedIndex={selectedIndex}
          size="compact"
        >
          <Tooltip content="Files" side="bottom">
            <TabsSubtleItem icon={FolderTree} index={0} label="Files" />
          </Tooltip>
          <Tooltip content="Document outline" side="bottom">
            <TabsSubtleItem icon={ListTree} index={1} label="Document outline" />
          </Tooltip>
        </TabsSubtle>
      </div>

      <SidebarContent>
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
    </>
  );
}
