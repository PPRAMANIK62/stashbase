/** The titlebar's quick way into a fresh conversation. It starts the same
 *  chat the Chats panel's **New chat** starts, with the same preferred Agent
 *  and scope, so the two entries can never disagree about what "new" means.
 *  With no runtime ready there is nothing to start, so the button waits,
 *  disabled, and says where to go. */
import { SquarePen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { AgentCatalogPort } from '@/features/agent/application/ports';
import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import { preferredAgent } from '@/features/agent/domain/agent-catalog';
import type { AgentScope } from '@/features/agent/domain/session';
import { useAgentCatalog } from '@/features/agent/hooks/use-agent-catalog';

export function NewChatButton({
  catalog,
  runtime,
  scope,
}: {
  catalog: AgentCatalogPort;
  runtime: AgentWorkspaceRuntime;
  scope: AgentScope;
}) {
  const { readyAgents } = useAgentCatalog(catalog);
  const defaultAgent = preferredAgent(readyAgents);
  return (
    <Tooltip
      content={defaultAgent ? 'New chat' : 'Set up an Agent in Settings first'}
      side="bottom"
    >
      <Button
        aria-label="New chat"
        disabled={defaultAgent === undefined}
        onClick={() => {
          if (defaultAgent) runtime.newChat(defaultAgent.id, scope);
        }}
        size="icon-compact"
        variant="ghost"
      >
        <SquarePen aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
