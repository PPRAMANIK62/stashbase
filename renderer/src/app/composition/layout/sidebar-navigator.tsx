/** The sidebar navigator: the folder header, and beneath it the Documents
 *  strip and the panes. It renders whatever the panel registry declares for
 *  the selected mode, and folds the strip and the panes under the header. */
import { motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import type {
  SidebarMode,
  SidebarPanelId,
} from '@/app/composition/commands/use-workspace-commands';
import { SidebarContent, SidebarGroup } from '@/components/ui/sidebar';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { Tooltip } from '@/components/ui/tooltip';
import { collapseTween, exitFallbackMs, spring } from '@/lib/springs';
import { useMotionTier } from '@/lib/use-motion-tier';
import { cn } from '@/lib/utils';

import type { SidebarPanel } from './sidebar-panels';

interface SidebarNavigatorProps {
  /** The id the folder header's toggle controls: the folded region. */
  contentId?: string;
  /** The folder row. It heads the column under the band in both modes, so
   *  switching modes never moves it; the mode's tab strip and the panes
   *  sit beneath it, and fold with it. */
  head?: ReactNode;
  onSelect(panel: SidebarPanelId): void;
  /** Whether the folder's region is unfolded. Default open. */
  open?: boolean;
  panels: readonly SidebarPanel[];
  selected: SidebarPanelId;
}

/** Renders whatever the panel registry declares for the selected panel's
 *  mode: one tab per panel in that mode when it has more than one, and one
 *  pane per panel in the region its `hidesTree` flag puts it in. The mode
 *  itself is chosen in the titlebar band; this only follows it.
 *
 *  The modes sit side by side on one track under the folder header, and
 *  switching slides the track the way a phone moves between screens: the mode
 *  being left walks off one edge while the one being chosen walks on from the
 *  other, so the band's switch reads as a place in a row rather than a swap.
 *  Both screens stay mounted for their scroll positions and their trees; the
 *  one off the track is hidden outright once the travel lands, rather than
 *  held off screen by a clip the rows' focus rings would then be shaved by. */
export function SidebarNavigator({
  contentId,
  head,
  onSelect,
  open = true,
  panels,
  selected,
}: SidebarNavigatorProps) {
  const navigatorId = useId();
  // The fold is a flex share, not a measured height: the region fills the
  // column down to the footer, so its height is whatever is left rather
  // than what its content adds up to. Its grow travels 1 → 0 while a spacer
  // beneath takes the same share the other way, so the footer keeps its
  // place and the region rolls up like a blind. Clipping only while it
  // moves or lies folded, so the rows' focus rings stay whole at rest. Eased
  // rather than sprung, like every other expand and collapse: what travels is
  // a box of space, and the footer below it should not be shoved.
  const fold = useMotionTier(collapseTween.moderate);
  // The screens travel the sidebar's own width, which is the short, precise
  // sort of move the moderate tier is for.
  const slide = useMotionTier(spring.moderate);
  const [folding, setFolding] = useState(false);

  const selectedPanel = panels.find((panel) => panel.id === selected);
  const activeMode = selectedPanel?.mode ?? panels[0]?.mode ?? null;
  // The modes the registry declares, in panel order. The order is the track's
  // order, so it is also which way a switch travels.
  const modes = [...new Set(panels.map((panel) => panel.mode))];
  const activeIndex = activeMode === null ? 0 : modes.indexOf(activeMode);

  // Which pane each mode is showing. A mode off the track keeps the pane it
  // was left on, so coming back lands where it was rather than on its first
  // tab, and its strip has a tab to mark selected while it waits.
  const shownByMode = useRef(new Map<SidebarMode, SidebarPanelId>());
  if (selectedPanel) shownByMode.current.set(selectedPanel.mode, selectedPanel.id);

  // The pane the switch is leaving, held until the travel lands: a panel that
  // mounts only when it is chosen (Chats) would otherwise empty on the first
  // frame and slide off as a blank column. Adjusted during render, because the
  // hold has to be in place on the very commit the screens retarget.
  const [previous, setPrevious] = useState({ mode: activeMode, panel: selected });
  const [leaving, setLeaving] = useState<SidebarPanelId | null>(null);
  if (previous.mode !== activeMode || previous.panel !== selected) {
    if (previous.mode !== activeMode) setLeaving(previous.panel);
    setPrevious({ mode: activeMode, panel: selected });
  }
  useEffect(() => {
    if (leaving === null) return;
    const id = setTimeout(() => setLeaving(null), exitFallbackMs(spring.moderate));
    return () => clearTimeout(id);
  }, [leaving]);
  const sliding = leaving !== null;

  const pane = (panel: SidebarPanel, mode: SidebarMode, shown: readonly SidebarPanel[]) => {
    const index = shown.indexOf(panel);
    const hasStrip = shown.length > 1;
    const showing = shownByMode.current.get(mode) === panel.id;
    // A pane with a tab of its own is that tab's panel; a pane in a mode
    // without a strip, or in the mode that is not showing, names itself.
    const labelling =
      hasStrip && index >= 0
        ? {
            'aria-labelledby': `${navigatorId}-${mode}-tab-${index}`,
            id: `${navigatorId}-${mode}-panel-${index}`,
            role: 'tabpanel',
          }
        : { 'aria-label': panel.label, role: 'region' };
    return (
      <div
        key={panel.id}
        {...labelling}
        {...(panel.hidesTree
          ? { className: showing ? 'flex min-h-0 flex-1 flex-col' : 'hidden' }
          : { hidden: !showing })}
      >
        {/* `active` is the pane the reader is on, or the one a switch is
            still carrying off the track. */}
        {panel.render(panel.id === selected || panel.id === leaving)}
      </div>
    );
  };

  const screen = (mode: SidebarMode, index: number) => {
    // The strip shows the mode's panels. A mode with one panel (Chats) has
    // nothing to choose between, so it gets no strip and the folder row
    // starts right under the band.
    const shown = panels.filter((panel) => panel.mode === mode);
    const hasStrip = shown.length > 1;
    const showingId = shownByMode.current.get(mode) ?? shown[0]?.id;
    const showing = shown.find((panel) => panel.id === showingId);
    const hidesTree = showing?.hidesTree ?? false;
    const keepsTree = shown.some((panel) => !panel.hidesTree);
    const onTrack = mode === activeMode;
    return (
      <motion.div
        animate={{ x: `${(index - activeIndex) * 100}%` }}
        aria-hidden={!onTrack}
        className={cn(
          'absolute inset-0 flex min-h-0 flex-col',
          // Off the track and settled, the screen is hidden rather than
          // merely pushed aside: nothing of it paints over the window beside
          // the sidebar, and it keeps its layout, so its scroll position and
          // its tree survive the trip.
          !onTrack && !sliding && 'invisible',
        )}
        inert={!onTrack}
        initial={false}
        key={mode}
        transition={slide}
      >
        {/* The strip is the band's mode switch one step down the ladder: the
         *  same track, so three glyphs read as one choice rather than three
         *  loose buttons. A track is an object rather than a row, so it is
         *  centred in the column. It sits under the folder header rather than
         *  over it, so switching modes changes what is beneath the name and
         *  never where the name is. 8px above and 12px beneath, not the even
         *  8/8 it used to keep: above, the header row's own leading is part of
         *  the gap, while beneath, the track's fill meets the first row or the
         *  search field's box edge to edge, and equal numbers read tighter
         *  under than over. The 4px here plus the 8px each panel already
         *  carries is what makes the 12. */}
        {hasStrip && (
          <div className="flex shrink-0 justify-center pt-2 pb-1">
            <TabsSubtle
              aria-label="Sidebar navigator"
              iconOnly
              idPrefix={`${navigatorId}-${mode}`}
              onSelect={(tab) => {
                const panel = shown[tab];
                if (panel) onSelect(panel.id);
              }}
              selectedIndex={shown.findIndex((panel) => panel.id === showingId)}
              size="compact"
              track
            >
              {shown.map((panel) => (
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
        )}
        {/* The scroll region keeps its own flex frame around the class it is
            given, so a panel that replaces the tree hides through an ancestor: a
            hidden frame takes no row, and Search or Chats starts right under the
            tabs. */}
        {keepsTree && (
          <div
            className={hidesTree ? 'hidden' : 'relative flex min-h-0 flex-1 flex-col'}
            hidden={hidesTree}
          >
            <SidebarContent>
              {/* px-0: the tree and outline panels carry their own 8px inset, so
                  the group's default horizontal padding would double it and push
                  their glyphs off the sidebar's shared 16px glyph column. */}
              <SidebarGroup className="px-0">
                {shown.map((panel) => (panel.hidesTree ? null : pane(panel, mode, shown)))}
              </SidebarGroup>
            </SidebarContent>
            {/* The list fades out at its foot instead of being cut by the
             *  footer's rule, the same way the transcript fades under the Chat
             *  header; the footer keeps no padding above its first rule, so the fade
             *  ends 4px short of the rule; over the paper the gradient is invisible. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-6 bg-gradient-to-t from-surface-1 to-transparent"
            />
          </div>
        )}
        {shown.map((panel) => (panel.hidesTree ? pane(panel, mode, shown) : null))}
      </motion.div>
    );
  };

  return (
    // The column from the folder name down to the footer is one hover scope:
    // the header's quick actions and fold chevron show while the pointer is
    // anywhere in it, and not over the band above or the footer below.
    <div className="group/group-header-hover flex min-h-0 flex-1 flex-col">
      {head}

      <motion.div
        animate={{ flexGrow: open ? 1 : 0 }}
        aria-hidden={!open}
        className={cn('flex min-h-0 basis-0 flex-col', (folding || !open) && 'overflow-hidden')}
        id={contentId}
        inert={!open}
        initial={false}
        onAnimationComplete={() => setFolding(false)}
        onAnimationStart={() => setFolding(true)}
        transition={fold}
      >
        {/* The track. It clips only while a screen is travelling: at rest the
            screen off the track is hidden outright, so a permanent clip would
            buy nothing and would shave the first and last rows' focus rings. */}
        <div className={cn('relative flex min-h-0 flex-1 flex-col', sliding && 'overflow-hidden')}>
          {modes.map((mode, index) => screen(mode, index))}
        </div>
      </motion.div>
      <motion.div
        animate={{ flexGrow: open ? 0 : 1 }}
        aria-hidden
        className="basis-0"
        initial={false}
        transition={fold}
      />
    </div>
  );
}
