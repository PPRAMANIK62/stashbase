import { FolderTree, ListTree } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';

import { SidebarContent, SidebarGroup } from '@/components/ui/sidebar';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { Tooltip } from '@/components/ui/tooltip';
import { DocumentOutline, type DocumentTabsRuntime } from '@/features/documents/public';

interface SidebarNavigatorProps {
  children: ReactNode;
  runtime: DocumentTabsRuntime | null;
}

function DocumentSidebarNavigator({
  children,
  runtime,
}: {
  children: ReactNode;
  runtime: DocumentTabsRuntime;
}) {
  const activeTabId = useStore(runtime.store, (state) => state.activeTabId);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigatorId = useId();

  useEffect(() => {
    if (!activeTabId) setSelectedIndex(0);
  }, [activeTabId]);

  return (
    <>
      {activeTabId && (
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
      )}

      <SidebarContent>
        <SidebarGroup>
          <div
            aria-labelledby={activeTabId ? `${navigatorId}-tab-0` : undefined}
            hidden={Boolean(activeTabId) && selectedIndex !== 0}
            id={activeTabId ? `${navigatorId}-panel-0` : undefined}
            role={activeTabId ? 'tabpanel' : undefined}
          >
            {children}
          </div>
          {activeTabId && (
            <div
              aria-labelledby={`${navigatorId}-tab-1`}
              hidden={selectedIndex !== 1}
              id={`${navigatorId}-panel-1`}
              role="tabpanel"
            >
              <DocumentOutline runtime={runtime} />
            </div>
          )}
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}

export function SidebarNavigator({ children, runtime }: SidebarNavigatorProps) {
  if (runtime) {
    return <DocumentSidebarNavigator runtime={runtime}>{children}</DocumentSidebarNavigator>;
  }

  return (
    <SidebarContent>
      <SidebarGroup>{children}</SidebarGroup>
    </SidebarContent>
  );
}
