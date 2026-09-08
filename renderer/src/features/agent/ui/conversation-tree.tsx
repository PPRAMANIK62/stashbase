import { MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { caretOffsetAtPoint, InlineInput } from '@/components/ui/inline-input';
import { MenuItem } from '@/components/ui/menu-item';
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { TreeDisclosure } from '@/components/ui/tree-disclosure';
import type {
  AgentConversationGroup,
  AgentHistoryEntry,
  AgentConversationItem,
} from '@/features/agent/domain/conversation-history';
import { fontWeights } from '@/lib/font-weight';

import { AGENT_ICONS } from './agent-presentation';

const CONVERSATION_PAGE_SIZE = 100;
const SINGLE_CLICK_DELAY_MS = 180;

function HistoryActions({
  entry,
  onDelete,
}: {
  entry: AgentHistoryEntry;
  onDelete(entry: AgentHistoryEntry): void;
}) {
  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <SidebarMenuAction
            aria-label={`Actions for ${entry.title || 'conversation'}`}
            showOnHover
          >
            <MoreHorizontal aria-hidden="true" />
          </SidebarMenuAction>
        }
      />
      <DropdownContent align="end" className="w-40">
        <MenuItem
          className="text-destructive"
          icon={Trash2}
          index={0}
          label="Delete"
          onSelect={() => onDelete(entry)}
        />
      </DropdownContent>
    </DropdownMenu>
  );
}

function ConversationRow({
  conversation,
  onActivate,
  onDelete,
  onRename,
  onRestore,
}: {
  conversation: AgentConversationItem;
  onActivate(tabId: string): void;
  onDelete(entry: AgentHistoryEntry): void;
  onRename(conversation: AgentConversationItem, title: string): void;
  onRestore(entry: AgentHistoryEntry): void;
}) {
  const [editing, setEditing] = useState(false);
  const [caretOffset, setCaretOffset] = useState<number | undefined>();
  const [title, setTitle] = useState(conversation.title);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AgentIcon = AGENT_ICONS[conversation.agent];

  const cancelPendingClick = () => {
    if (clickTimer.current === null) return;
    clearTimeout(clickTimer.current);
    clickTimer.current = null;
  };

  useEffect(() => cancelPendingClick, []);

  const activate = () => {
    if (conversation.tabId) onActivate(conversation.tabId);
    else if (conversation.entry) onRestore(conversation.entry);
  };
  const beginEdit = (nextCaretOffset?: number) => {
    cancelPendingClick();
    activate();
    setCaretOffset(nextCaretOffset);
    setTitle(conversation.title);
    setEditing(true);
  };
  const cancelEdit = () => {
    setTitle(conversation.title);
    setEditing(false);
  };
  const submitEdit = () => {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === conversation.title) {
      cancelEdit();
      return;
    }
    setEditing(false);
    void onRename(conversation, nextTitle);
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) {
      activate();
      return;
    }
    cancelPendingClick();
    if (event.detail > 1) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      activate();
    }, SINGLE_CLICK_DELAY_MS);
  };

  return (
    <SidebarMenuItem>
      {editing ? (
        <SidebarMenuButton
          aria-label={`Editing ${conversation.title}`}
          className="pl-1.5"
          icon={AgentIcon}
          isActive={conversation.active}
          render={<div data-conversation-inline-editor="" />}
          tabIndex={-1}
        >
          <InlineInput
            aria-label={`Rename ${conversation.title}`}
            caretOffset={caretOffset}
            className="min-w-0 text-inherit [font:inherit]"
            onCancel={cancelEdit}
            onChange={setTitle}
            onCommit={submitEdit}
            style={{
              fontVariationSettings: conversation.active
                ? fontWeights.semibold
                : fontWeights.normal,
            }}
            value={title}
          />
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          className="pl-1.5"
          data-conversation=""
          icon={AgentIcon}
          isActive={conversation.active}
          onClick={handleClick}
          onDoubleClick={(event) => {
            event.preventDefault();
            const target = event.target instanceof HTMLElement ? event.target : event.currentTarget;
            beginEdit(caretOffsetAtPoint(target, event.clientX, event.clientY));
          }}
          onKeyDown={(event) => {
            if (event.key === 'F2') {
              event.preventDefault();
              beginEdit();
            }
          }}
          title={conversation.title}
        >
          {conversation.title}
        </SidebarMenuButton>
      )}
      {!editing && conversation.entry && (
        <HistoryActions entry={conversation.entry} onDelete={onDelete} />
      )}
    </SidebarMenuItem>
  );
}

function ConversationGroup({
  group,
  onActivate,
  onDelete,
  onRename,
  onRestore,
}: {
  group: AgentConversationGroup;
  onActivate(tabId: string): void;
  onDelete(entry: AgentHistoryEntry): void;
  onRename(conversation: AgentConversationItem, title: string): void;
  onRestore(entry: AgentHistoryEntry): void;
}) {
  const [visibleCount, setVisibleCount] = useState(CONVERSATION_PAGE_SIZE);
  const visibleItems = group.items.slice(0, visibleCount);

  return (
    <TreeDisclosure label={group.label}>
      <SidebarMenu aria-label={`${group.label} chats`}>
        {visibleItems.map((conversation) => (
          <ConversationRow
            conversation={conversation}
            key={conversation.id}
            onActivate={onActivate}
            onDelete={onDelete}
            onRename={onRename}
            onRestore={onRestore}
          />
        ))}
      </SidebarMenu>
      {visibleItems.length < group.items.length && (
        <Button
          className="mt-1 ml-1"
          onClick={() => setVisibleCount((count) => count + CONVERSATION_PAGE_SIZE)}
          size="compact"
          variant="ghost"
        >
          Show more
        </Button>
      )}
    </TreeDisclosure>
  );
}

export function ConversationTree({
  groups,
  onActivate,
  onDelete,
  onRename,
  onRestore,
}: {
  groups: AgentConversationGroup[];
  onActivate(tabId: string): void;
  onDelete(entry: AgentHistoryEntry): void;
  onRename(conversation: AgentConversationItem, title: string): void;
  onRestore(entry: AgentHistoryEntry): void;
}) {
  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <ConversationGroup
          group={group}
          key={group.id}
          onActivate={onActivate}
          onDelete={onDelete}
          onRename={onRename}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
}
