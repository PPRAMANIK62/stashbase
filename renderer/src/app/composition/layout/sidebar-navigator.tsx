import { useId } from 'react';

import type { SidebarPanelId } from '@/app/composition/commands/use-workspace-commands';
import { SidebarContent, SidebarGroup } from '@/components/ui/sidebar';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { Tooltip } from '@/components/ui/tooltip';

import type { SidebarPanel } from './sidebar-panels';

interface SidebarNavigatorProps {
  onSelect(panel: SidebarPanelId): void;
  panels: readonly SidebarPanel[];
  selected: SidebarPanelId;
}

/** Renders whatever the panel registry declares: one tab per panel, and one
 *  `tabpanel` per panel in the region its `hidesTree` flag puts it in. */
export function SidebarNavigator({ onSelect, panels, selected }: SidebarNavigatorProps) {
  const navigatorId = useId();
  const selectedIndex = panels.findIndex((panel) => panel.id === selected);
  const hidesTree = panels[selectedIndex]?.hidesTree ?? false;

  const pane = (panel: SidebarPanel, index: number) => (
    <div
      aria-labelledby={`${navigatorId}-tab-${index}`}
      id={`${navigatorId}-panel-${index}`}
      key={panel.id}
      role="tabpanel"
      {...(panel.hidesTree
        ? { className: selected === panel.id ? 'flex min-h-0 flex-1 flex-col' : 'hidden' }
        : { hidden: selected !== panel.id })}
    >
      {panel.render(selected === panel.id)}
    </div>
  );

  return (
    <>
      <div className="flex shrink-0 justify-center px-4 pt-2 pb-1">
        <TabsSubtle
          aria-label="Sidebar navigator"
          iconOnly
          idPrefix={navigatorId}
          onSelect={(index) => {
            const panel = panels[index];
            if (panel) onSelect(panel.id);
          }}
          selectedIndex={selectedIndex}
          size="compact"
        >
          {panels.map((panel) => (
            <Tooltip content={panel.hint ?? panel.label} key={panel.id} side="bottom">
              <TabsSubtleItem
                aria-keyshortcuts={panel.keyshortcuts}
                icon={panel.icon}
                label={panel.label}
              />
            </Tooltip>
          ))}
        </TabsSubtle>
      </div>

      {/* The scroll region keeps its own flex frame around the class it is
          given, so a panel that replaces the tree hides through an ancestor: a
          hidden frame takes no row, and Search or Chats starts right under the
          tabs. */}
      <div className={hidesTree ? 'hidden' : 'flex min-h-0 flex-1 flex-col'} hidden={hidesTree}>
        <SidebarContent>
          <SidebarGroup>
            {panels.map((panel, index) => (panel.hidesTree ? null : pane(panel, index)))}
          </SidebarGroup>
        </SidebarContent>
      </div>
      {panels.map((panel, index) => (panel.hidesTree ? pane(panel, index) : null))}
    </>
  );
}
