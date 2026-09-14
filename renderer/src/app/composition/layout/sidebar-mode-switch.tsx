import type { SidebarMode } from '@/app/composition/commands/use-workspace-commands';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { Tooltip } from '@/components/ui/tooltip';

import type { SidebarModeEntry } from './sidebar-panels';

interface SidebarModeSwitchProps {
  modes: readonly SidebarModeEntry[];
  onSelect(mode: SidebarMode): void;
  selected: SidebarMode;
}

/** The titlebar band's mode switch: Documents or Chats, deciding what the
 *  column beneath the folder shows. It is the navigator's glyph strip drawn
 *  on a track, the segmented look: a muted bar one step down the ladder from
 *  the band's squares, so it sits inside them rather than matching them,
 *  with the selected glyph on a lifted pill that glides across when the
 *  other is chosen. It switches the sidebar and nothing else: the
 *  Chat pane's visibility stays with the workspace titlebar's own toggle. */
export function SidebarModeSwitch({ modes, onSelect, selected }: SidebarModeSwitchProps) {
  const selectedIndex = modes.findIndex((mode) => mode.id === selected);
  return (
    <TabsSubtle
      aria-label="Sidebar mode"
      iconOnly
      onSelect={(index) => {
        const mode = modes[index];
        if (mode) onSelect(mode.id);
      }}
      selectedIndex={selectedIndex}
      size="compact"
      track
    >
      {modes.map((mode) => (
        <Tooltip content={mode.label} key={mode.id} side="bottom">
          {/* 30px wide, the band's square, so the switch keeps the trio's pitch. */}
          <TabsSubtleItem icon={mode.icon} label={mode.label} />
        </Tooltip>
      ))}
    </TabsSubtle>
  );
}
