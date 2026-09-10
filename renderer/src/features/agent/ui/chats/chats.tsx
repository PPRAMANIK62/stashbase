import { Layers, RefreshCw, SquarePen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import { preferredAgent } from '@/features/agent/domain/agent-catalog';
import {
  buildConversationGroups,
  type AgentConversationItem,
  type AgentHistoryEntry,
} from '@/features/agent/domain/conversation-history';
import { useAgentCatalog } from '@/features/agent/hooks/use-agent-catalog';
import { useConversationHistory } from '@/features/agent/hooks/use-conversation-history';
import type { AgentChatsProps } from '@/features/agent/ui/workspace-lazy';

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
      <div className="shrink-0 px-2 pt-2 pb-1">
        {defaultAgent ? (
          <Button
            aria-label="Start new chat"
            className="w-full justify-start"
            leadingIcon={SquarePen}
            onClick={() => runtime.newChat(defaultAgent.id, scope)}
            size="default"
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

      <div
        aria-label={`Conversation tree in ${workspaceName}`}
        className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-2"
      >
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
  );
}
