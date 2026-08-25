import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

import { cn } from '@/common/lib/utils';

/**
 * Tab set — shadcn part names over Base UI's Tabs.
 *
 * Base UI owns roving focus, arrow-key movement, and the
 * `aria-controls`/`aria-labelledby` pairing between a tab and its panel.
 * The app had three independently hand-rolled `role="tablist"` blocks; two
 * of them — the Settings sections and the chat session strip — could not be
 * operated from the keyboard at all, and both are on this primitive now.
 *
 * Both orientations live here because they are one control: the Settings
 * sidebar is a vertical tab list and a pane strip is a horizontal one, and
 * letting them diverge is how the app grew three of these.
 *
 * `activateOnFocus` is deliberately NOT defaulted here — it is the one
 * decision that depends on what a panel costs to show, so each `TabsList`
 * states it. Base UI's own default is off. The chat session strip opts in
 * (every pane is already mounted, so moving the caret costs nothing);
 * Settings leaves it off, because its panels unmount when inactive and
 * each fetches on mount, so arrowing past one would fire a request. The
 * hand-rolled document `TabStrip` matches the chat strip.
 *
 * The third — the document `TabStrip` — deliberately stays hand-rolled, for
 * bundle reasons only (the exception `ui/menu-radio.tsx` also carries). Both
 * consumers here load behind an interaction boundary; the document strip
 * mounts with the window, and Base UI's composite/roving-focus machinery is
 * ~22.7 KB of always-loaded JS. It already implemented this keyboard
 * contract, so it keeps it locally and matches `data-active` — see the
 * comment on `TabStrip` before changing selection behavior in either place.
 */
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('group/tabs flex data-[orientation=horizontal]:flex-col', className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex gap-0.5',
        'data-[orientation=vertical]:flex-col',
        'data-[orientation=horizontal]:items-center data-[orientation=horizontal]:border-b data-[orientation=horizontal]:border-border',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // An item inside a box, so `rounded-md` — the corner a menu row or
        // a tree row takes.
        'cursor-pointer rounded-md border-0 bg-transparent px-3 py-2 text-left text-base whitespace-nowrap text-muted-foreground outline-none',
        'transition-tint hover:bg-muted hover:text-foreground',
        'focus-visible:relative focus-visible:z-raised focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus',
        // `data-active`, NOT `data-selected`. Base UI's TabsTabDataAttributes
        // enum names this state `active`, and it emits no `data-selected` at
        // all — so the three rules that used to sit here matched nothing and
        // the Settings sidebar rendered with no visible selected tab. The
        // mistake is invisible in review because the class name reads exactly
        // like the concept it is styling.
        'data-active:bg-active data-active:text-foreground data-active:hover:bg-active',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn('min-w-0 outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
