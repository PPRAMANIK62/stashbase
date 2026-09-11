/** Back and forward through the window's open Chats, in tab order. The pair
 *  sits in the sidebar's titlebar band beside the collapse toggle, and only
 *  while a folder is open — like the new-chat control, it does not render
 *  for a window with nothing to step through. Either end of the tab order
 *  disables its own arrow. */
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import { useSizeVariant } from '@/lib/size-context';

export function ChatNavButtons({ runtime }: { runtime: AgentWorkspaceRuntime }) {
  // The same size rule as the sidebar trigger beside the pair, so the three
  // glyphs read as one row.
  const size = useSizeVariant() === 'compact' ? ('icon-compact' as const) : ('icon' as const);
  const activeId = useStore(runtime.store, (state) => state.activeId);
  const tabs = useStore(runtime.store, (state) => state.tabs);
  const index = tabs.findIndex((tab) => tab.id === activeId);
  const previous = index > 0 ? tabs[index - 1] : undefined;
  const next = index === -1 ? undefined : tabs[index + 1];
  return (
    <>
      <Tooltip content="Previous chat" side="bottom">
        <Button
          aria-label="Previous chat"
          className="-ml-1"
          disabled={previous === undefined}
          onClick={() => {
            if (previous) runtime.activate(previous.id);
          }}
          size={size}
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
      </Tooltip>
      <Tooltip content="Next chat" side="bottom">
        <Button
          aria-label="Next chat"
          className="-ml-1"
          disabled={next === undefined}
          onClick={() => {
            if (next) runtime.activate(next.id);
          }}
          size={size}
          variant="ghost"
        >
          <ArrowRight aria-hidden="true" />
        </Button>
      </Tooltip>
    </>
  );
}
