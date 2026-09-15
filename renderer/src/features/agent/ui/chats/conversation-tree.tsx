/** The chat list in the sidebar: recency groups, each conversation as a row
 *  that opens on a click and renames in place on a slow second click or F2,
 *  and a per-row menu for deletion. Grouping and ordering are decided in the
 *  domain; this module owns the interaction and the editing affordance. */
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
import { AGENT_ICONS } from '@/shared/brand/agent-icons';

const CONVERSATION_PAGE_SIZE = 100;

function HistoryActions({
  entry,
  title,
  onDelete,
  onRename,
}: {
  entry: AgentHistoryEntry | undefined;
  title: string;
  onDelete(entry: AgentHistoryEntry): void;
  onRename(): void;
}) {
  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <SidebarMenuAction aria-label={`Actions for ${title || 'conversation'}`} showOnHover>
            <MoreHorizontal aria-hidden="true" />
          </SidebarMenuAction>
        }
      />
      <DropdownContent align="end" className="w-40">
        <MenuItem icon={Pencil} label="Rename" onSelect={onRename} />
        {entry && (
          <MenuItem
            className="text-destructive"
            icon={Trash2}
            label="Delete"
            onSelect={() => onDelete(entry)}
          />
        )}
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
  const AgentIcon = AGENT_ICONS[conversation.agent];

  const activate = () => {
    if (conversation.tabId) onActivate(conversation.tabId);
    else if (conversation.entry) onRestore(conversation.entry);
  };
  const beginEdit = (nextCaretOffset?: number) => {
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
            className="min-w-0 text-inherit [font:inherit]"
            {...(caretOffset === undefined ? {} : { caretOffset })}
            onCancel={cancelEdit}
            onChange={setTitle}
            onCommit={submitEdit}
            // The editor keeps the row's own weight, which is the same
            // whether the conversation is current or not.
            style={{ fontVariationSettings: fontWeights.normal }}
            value={title}
          />
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          className="pl-1.5"
          data-conversation=""
          icon={AgentIcon}
          isActive={conversation.active}
          onClick={activate}
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
          label={conversation.title}
          aria-label={`${conversation.title}${conversation.draft ? ', Draft' : ''}${conversation.status ? `, ${conversation.status}` : ''}`}
          title={conversation.title}
        >
          {conversation.status === 'Working…' || conversation.status === 'Waiting for approval' ? (
            <span className="text-caption text-muted-foreground">
              {conversation.status === 'Working…' ? 'Working' : 'Approval'}
            </span>
          ) : conversation.draft ? (
            <span className="text-caption text-muted-foreground">Draft</span>
          ) : undefined}
        </SidebarMenuButton>
      )}
      {!editing && (
        <HistoryActions
          entry={conversation.entry}
          title={conversation.title}
          onDelete={onDelete}
          onRename={() => beginEdit()}
        />
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
