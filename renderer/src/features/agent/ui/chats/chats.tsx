/**
 * The sidebar's Chats panel: the folder's conversations, listed by day under
 * a Recent label, with New chat above them and rename and delete on each
 * row. The panel sits on the sidebar's row, the compact step the whole
 * column under the band reads; the header's history popover is the quick
 * way in, this is the manager.
 */
import { Layers, MessageCirclePlus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { SidebarGroupLabel } from '@/components/ui/sidebar-group-label';
import { preferredAgent } from '@/features/agent/domain/agent-catalog';
import {
  buildConversationGroups,
  type AgentConversationItem,
  type AgentHistoryEntry,
} from '@/features/agent/domain/conversation-history';
import { useAgentCatalog } from '@/features/agent/hooks/use-agent-catalog';
import { useConversationHistory } from '@/features/agent/hooks/use-conversation-history';
import type { AgentChatsProps } from '@/features/agent/ui/workspace-lazy';
import { FailureLine } from '@/shared/ui/failure-notice';

import { ConversationTree } from './conversation-tree';
import { DeleteConversationDialog } from './delete-conversation-dialog';

export default function AgentChats({
  catalog: catalogPort,
  onOpenAgentSettings,
  runtime,
  scope,
  workspaceName,
}: AgentChatsProps) {
  const { readyAgents } = useAgentCatalog(catalogPort);
  const history = useConversationHistory(runtime, scope);
  const activeId = useStore(runtime.store, (state) => state.activeId);
  const tabs = useStore(runtime.store, (state) => state.tabs);
  const [deleteTarget, setDeleteTarget] = useState<AgentHistoryEntry | null>(null);
  const conversationGroups = useMemo(
    () => buildConversationGroups({ activeId, history: history.history, scope, tabs }),
    [activeId, history.history, scope, tabs],
  );
  const conversationCount = conversationGroups.reduce(
    (total, group) => total + group.items.length,
    0,
  );
  const defaultAgent = preferredAgent(readyAgents);

  const closeDelete = () => {
    history.clearMutationFailure();
    setDeleteTarget(null);
  };

  const rename = (conversation: AgentConversationItem, title: string) => {
    history.clearMutationFailure();
    if (conversation.entry) {
      void history.rename(conversation.entry, title);
      return;
    }
    if (!conversation.tabId) return;
    const session = runtime.session(conversation.tabId);
    session?.rename(title);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label={`Chats in ${workspaceName}`}>
      {/* New chat is the panel's primary action, so it is a standing sidebar
       *  row, the same row the footer's Gallery and the list beneath are:
       *  first by position, told by its plus, and never larger. The wrapper's
       *  px-2 and the row's own inset put its glyph on the shared 16px column
       *  with the footer rows' and the folder header's. */}
      <div className="shrink-0 px-2 pt-2 pb-1">
        {defaultAgent ? (
          <SidebarMenu aria-label="New chat">
            <SidebarMenuItem>
              <SidebarMenuButton
                aria-label="Start new chat"
                icon={MessageCirclePlus}
                onClick={() => runtime.newChat(defaultAgent.id, scope)}
              >
                New chat
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <Button
            className="w-full justify-start"
            leadingIcon={Layers}
            onClick={onOpenAgentSettings}
            variant="secondary"
          >
            Set up an Agent
          </Button>
        )}
      </div>

      {/* A rule sets the creation control off from the history beneath it,
       *  and the history says what it is: the folder's recent chats, in
       *  the day groups that follow. `mx-4` is the footer rules' 16px inset
       *  — one 8px step inside where a row's hover fill starts — reached
       *  without a container padding to add to, so every rule in the column
       *  sits on one line. */}
      <hr className="mx-4 my-1 h-px border-0 bg-border" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          aria-label={`Conversation tree in ${workspaceName}`}
          className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2"
        >
          {/* The list is one section under a Chats label that folds it, the
           *  way a day group folds under its own header: the same caption
           *  size and grey as those headers, the same hover, and the fold
           *  chevron at its end under the pointer. p-0: the scroll region
           *  already carries the 8px inset. */}
          <SidebarGroup className="p-0" collapsible>
            <SidebarGroupLabel className="h-7 text-caption text-muted-foreground hover:bg-hover hover:text-foreground">
              Chats
            </SidebarGroupLabel>
            {history.historyLoading && conversationCount === 0 && (
              <p className="px-2 py-1 text-caption text-muted-foreground">Loading chats…</p>
            )}
            {!history.historyLoading && conversationCount === 0 && !history.historyFailure && (
              <p className="px-2 py-1 text-caption text-muted-foreground">
                No chats yet in {workspaceName}.
              </p>
            )}
            <ConversationTree
              groups={conversationGroups}
              onActivate={runtime.activate}
              onDelete={(entry) => {
                history.clearMutationFailure();
                setDeleteTarget(entry);
              }}
              onRename={rename}
              onRestore={(entry) => void runtime.restore(entry)}
            />
            {history.mutationFailure && deleteTarget === null && (
              <FailureLine className="px-2 py-1" tone="input">
                {history.mutationFailure}
              </FailureLine>
            )}
            {history.historyFailure && (
              <div className="px-2 py-1">
                <FailureLine tone="input">{history.historyFailure}</FailureLine>
                <Button
                  className="mt-2"
                  leadingIcon={RefreshCw}
                  onClick={() => void history.retry()}
                  size="compact"
                  variant="ghost"
                >
                  Retry
                </Button>
              </div>
            )}
          </SidebarGroup>
        </div>
        {/* The list fades out at its foot instead of being cut by the
         *  footer's rule, the same way the transcript fades under the Chat
         *  header; the footer keeps no padding above its first rule, so the fade
         *  ends 4px short of the rule; over the paper the gradient is invisible. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-6 bg-gradient-to-t from-surface-1 to-transparent"
        />
      </div>

      <DeleteConversationDialog
        entry={deleteTarget}
        failure={history.mutationFailure}
        onClose={closeDelete}
        onDelete={history.remove}
        pending={history.mutationPending}
        workspaceName={workspaceName}
      />
    </div>
  );
}
