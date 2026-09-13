/**
 * The sidebar's Chats panel: the folder's conversations, listed by day under
 * a Recent label, with New chat above them and rename and delete on each
 * row. The panel sits on the compact step so its rows share the Files
 * tree's rhythm; the header's history popover is the quick way in, this is
 * the manager.
 */
import { Layers, MessageCirclePlus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
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
import { SizeProvider } from '@/lib/size-context';

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
    // The compact step, so the panel's rows sit on the Files tree's 28px
    // rhythm with its 12px labels and 14px glyphs, and switching between
    // the two panels changes what is listed rather than the size of a row.
    <SizeProvider size="compact">
      <div className="flex min-h-0 flex-1 flex-col" aria-label={`Chats in ${workspaceName}`}>
        <div className="shrink-0 px-2 pt-2 pb-1">
          {defaultAgent ? (
            <Button
              aria-label="Start new chat"
              // pl-2 over the wrapper's px-2 puts the glyph box at 16px — the
              // sidebar's shared icon column, where the group chevrons and the
              // footer rows below keep theirs.
              className="w-full justify-start pl-2"
              leadingIcon={MessageCirclePlus}
              onClick={() => runtime.newChat(defaultAgent.id, scope)}
              size="compact"
              variant="ghost"
            >
              New chat
            </Button>
          ) : (
            <Button
              className="w-full justify-start"
              leadingIcon={Layers}
              onClick={onOpenAgentSettings}
              size="compact"
              variant="secondary"
            >
              Set up an Agent
            </Button>
          )}
        </div>

        {/* A rule sets the creation control off from the history beneath it,
         *  and the history says what it is: the folder's recent chats, in
         *  the day groups that follow. */}
        <hr className="mx-2 my-1 h-px border-0 bg-border" />
        <div
          aria-label={`Conversation tree in ${workspaceName}`}
          className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2"
        >
          {/* text-caption holds the label at the day headers' 12px rather
           *  than the compact step's 11px, so the two label kinds match. */}
          <SidebarGroupLabel className="text-caption">Recent</SidebarGroupLabel>
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
            <p className="px-2 py-1 text-caption text-destructive" role="alert">
              {history.mutationFailure}
            </p>
          )}
          {history.historyFailure && (
            <div className="px-2 py-1">
              <p className="text-caption text-destructive" role="alert">
                {history.historyFailure}
              </p>
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
    </SizeProvider>
  );
}
