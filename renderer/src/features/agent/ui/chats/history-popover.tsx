/**
 * The Chat pane's own way to the rest of the folder's conversations: a
 * popover under the header's clock with a search field and the recent chats,
 * newest first, each with how long ago it last moved. A row opens the
 * conversation, switching to its tab when one is open and restoring it from
 * history otherwise, and the popover closes behind it. Renaming and deleting
 * stay with the sidebar's Chats panel; this is the quick way back, not the
 * manager.
 */
import { Popover } from '@base-ui/react/popover';
import { Clock } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import { CommandInput, CommandItem, CommandList } from '@/components/ui/command-menu';
import { Elevated } from '@/components/ui/elevated';
import { Tooltip } from '@/components/ui/tooltip';
import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import {
  buildConversationGroups,
  type AgentConversationItem,
} from '@/features/agent/domain/conversation-history';
import { scopeLabel, type AgentScope } from '@/features/agent/domain/session';
import { ageLabel } from '@/features/agent/domain/time';
import { useConversationHistory } from '@/features/agent/hooks/use-conversation-history';
import { useShape } from '@/lib/shape-context';
import { SizeProvider } from '@/lib/size-context';
import { cn } from '@/lib/utils';

const ROW_LIMIT = 50;

/** Where an arrow key moves the active row, or null for a key that is not
 *  one of the list's. */
function nextActive(key: string, active: number, count: number): number | null {
  switch (key) {
    case 'ArrowDown':
      return Math.min(active + 1, count - 1);
    case 'ArrowUp':
      return Math.max(active - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export function ChatHistoryPopover({
  runtime,
  scope,
}: {
  runtime: AgentWorkspaceRuntime;
  scope: AgentScope;
}) {
  const shape = useShape();
  const listId = useId();
  const searchField = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // "Now" is read as the popover opens, so the ages hold still while the
  // list is in front of the reader.
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const history = useConversationHistory(runtime, scope);
  const activeId = useStore(runtime.store, (state) => state.activeId);
  const tabs = useStore(runtime.store, (state) => state.tabs);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return buildConversationGroups({ activeId, history: history.history, now, scope, tabs })
      .flatMap((group) => group.items)
      .filter((item) => needle === '' || item.title.toLowerCase().includes(needle))
      .slice(0, ROW_LIMIT);
  }, [activeId, history.history, now, query, scope, tabs]);

  useEffect(() => setActiveIndex(0), [query, rows.length]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => searchField.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const openConversation = (row: AgentConversationItem) => {
    setOpen(false);
    if (row.tabId) runtime.activate(row.tabId);
    else if (row.entry) void runtime.restore(row.entry);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || rows.length === 0) return;
    const selected = rows[activeIndex];
    if (event.key === 'Enter' && selected) {
      event.preventDefault();
      openConversation(selected);
      return;
    }
    const target = nextActive(event.key, activeIndex, rows.length);
    if (target === null) return;
    event.preventDefault();
    setActiveIndex(target);
  };

  const loading = history.historyLoading && rows.length === 0;
  const empty = !loading && rows.length === 0;

  return (
    <Popover.Root
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setNow(Date.now());
        else setQuery('');
      }}
      open={open}
    >
      <Tooltip content="Chat history" side="bottom">
        <Popover.Trigger
          render={
            // The same compact square as New chat beside it.
            <Button aria-label="Chat history" size="icon-compact" variant="ghost" />
          }
        >
          <Clock aria-hidden="true" />
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner align="end" className="z-50 outline-none" side="bottom" sideOffset={6}>
          <Popover.Popup
            aria-label="Chat history"
            // The kit's menu width and the compact step: the rows sit on the
            // sidebar's 28px rhythm and the field on its 40px prompt height,
            // so the popover reads as one more of the app's menus rather
            // than the full-size command palette.
            className={cn(
              'flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden outline-none',
              shape.container,
            )}
            render={<Elevated offset={2} shadowLevel={3} />}
          >
            <SizeProvider size="compact">
              {/* The palette's prompt height and 14px text belong to the full-size
               *  command palette; here the field takes the rows' 12px, a 32px height,
               *  and the sidebar's 14px search glyph, so it reads at the popover's
               *  own scale rather than shouting over the list. */}
              <div className="[&>div]:h-8 [&>div]:px-3 [&>div>svg]:size-3.5">
                <CommandInput
                  className="text-[12px]"
                  aria-activedescendant={
                    rows[activeIndex] ? `${listId}-row-${activeIndex}` : undefined
                  }
                  aria-autocomplete="list"
                  aria-controls={rows.length > 0 ? listId : undefined}
                  aria-expanded={rows.length > 0}
                  aria-label="Search recent chats"
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="Search recent chats"
                  ref={searchField}
                  role="combobox"
                  spellCheck={false}
                  value={query}
                />
              </div>
              {loading && (
                <p className="px-4 py-3 text-caption text-muted-foreground" role="status">
                  Loading chats…
                </p>
              )}
              {empty && (
                <p className="px-4 py-3 text-caption text-muted-foreground" role="status">
                  {query.trim() ? 'No matching chats.' : `No chats yet in ${scopeLabel(scope)}.`}
                </p>
              )}
              {rows.length > 0 && (
                <CommandList
                  activeIndex={activeIndex}
                  aria-label="Recent chats"
                  // Five rows before the list scrolls: enough to find a recent
                  // chat, short enough to leave the empty Chat's greeting in view
                  // beneath the popover.
                  className="max-h-40"
                  id={listId}
                  onActiveIndexChange={setActiveIndex}
                >
                  {rows.map((row, index) => {
                    const age = ageLabel(row.lastModified, now);
                    return (
                      <CommandItem
                        aria-label={`${row.title}, ${age}`}
                        id={`${listId}-row-${index}`}
                        key={row.id}
                        onClick={() => openConversation(row)}
                      >
                        <span className="min-w-0 flex-1 truncate text-foreground">{row.title}</span>
                        <span className="ml-auto shrink-0 text-caption text-muted-foreground tabular-nums">
                          {age}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
              )}
            </SizeProvider>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
