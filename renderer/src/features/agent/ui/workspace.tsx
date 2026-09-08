import { ChevronDown, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { scopeLabel, type AgentSessionPhase } from '@/features/agent/domain/session';
import { useAgentCatalog } from '@/features/agent/hooks/use-agent-catalog';
import { cn } from '@/lib/utils';
import type { Agent } from '@/shared/agent-runtime';

import { AGENT_ICONS } from './agent-presentation';
import { AgentSetup } from './agent-setup';
import { AgentTranscript } from './transcript';
import type { AgentWorkspaceProps } from './workspace-lazy';

function phaseLabel(phase: AgentSessionPhase, error: string | null): string {
  switch (phase) {
    case 'draft':
      return 'Ready for Chat';
    case 'restoring':
      return 'Restoring conversation…';
    case 'connecting':
      return 'Connecting…';
    case 'live':
      return 'Ready for Chat';
    case 'closed':
      return error ?? 'Disconnected';
    case 'retired':
      return 'Folder removed · transcript preserved';
    case 'disposed':
      return 'Conversation closed';
  }
}

function ReadyWorkspace({
  agents,
  runtime,
  withDocuments,
}: Omit<AgentWorkspaceProps, 'catalog' | 'onOpenAgentSettings'> & { agents: Agent[] }) {
  const activeId = useStore(runtime.store, (state) => state.activeId);
  const active = runtime.session(activeId) ?? runtime.activeSession();
  const state = useStore(
    active.store,
    useShallow((session) => ({
      agent: session.agent,
      error: session.error,
      phase: session.phase,
      scope: session.scope,
      transcript: session.transcript,
    })),
  );
  const ActiveIcon = AGENT_ICONS[state.agent];
  const activeAgent = agents.find((agent) => agent.id === state.agent);
  const activeAgentIndex = agents.findIndex((agent) => agent.id === state.agent);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col bg-surface-2',
        withDocuments ? 'w-[min(36rem,42vw)] shrink-0 border-l border-border' : 'h-full w-full',
      )}
    >
      <div
        aria-live="polite"
        aria-label="Conversation transcript"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-6"
        role="log"
      >
        {state.transcript.length === 0 ? (
          <div className="m-auto max-w-sm text-center">
            <h2 className="text-title font-semibold text-foreground">Start a conversation</h2>
            <p className="mt-1 text-caption text-muted-foreground">
              Working in {scopeLabel(state.scope)}
            </p>
            <div className="mt-4 flex justify-center">
              <DropdownMenu>
                <DropdownTrigger
                  render={
                    <Button
                      aria-label={`Choose Agent. Current Agent: ${activeAgent?.label ?? 'Agent'}`}
                      leadingIcon={ActiveIcon}
                      size="compact"
                      trailingIcon={ChevronDown}
                      variant="tertiary"
                    >
                      {activeAgent?.label ?? 'Choose Agent'}
                    </Button>
                  }
                />
                <DropdownContent
                  align="center"
                  checkedIndex={activeAgentIndex < 0 ? undefined : activeAgentIndex}
                  className="w-52"
                >
                  {agents.map((agent, index) => (
                    <MenuItem
                      checked={agent.id === state.agent}
                      icon={AGENT_ICONS[agent.id]}
                      index={index}
                      key={agent.id}
                      label={agent.label}
                      onSelect={() => runtime.newChat(agent.id, state.scope)}
                    />
                  ))}
                </DropdownContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <AgentTranscript blocks={state.transcript} key={activeId} />
        )}
      </div>

      {state.phase !== 'draft' && (
        <footer className="flex h-11 shrink-0 items-center gap-2 border-t border-border px-3 text-caption text-muted-foreground">
          <span
            className={cn(
              'size-1.5 rounded-full',
              state.phase === 'live' ? 'bg-foreground/70' : 'bg-muted-foreground',
            )}
          />
          <span>{phaseLabel(state.phase, state.error)}</span>
          {state.phase === 'closed' && (
            <Button
              className="ml-auto"
              leadingIcon={RefreshCw}
              onClick={active.reconnect}
              size="compact"
              variant="ghost"
            >
              Reconnect
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}

export default function ManagedAgentWorkspace(props: AgentWorkspaceProps) {
  const catalog = useAgentCatalog(props.catalog);
  const activeId = useStore(props.runtime.store, (state) => state.activeId);
  const active = props.runtime.session(activeId) ?? props.runtime.activeSession();
  const activeAgentId = useStore(active.store, (state) => state.agent);

  useEffect(() => {
    props.runtime.start(catalog.readyAgents.map((agent) => agent.id));
  }, [catalog.readyAgents, props.runtime]);

  if (catalog.readyAgents.some((agent) => agent.id === activeAgentId)) {
    return <ReadyWorkspace {...props} agents={catalog.readyAgents} />;
  }

  return (
    <AgentSetup
      agents={catalog.agents.filter(
        (agent) => !catalog.readyAgents.some((ready) => ready.id === agent.id),
      )}
      error={catalog.error}
      loading={catalog.loading}
      onOpenSettings={props.onOpenAgentSettings}
      onPrepare={(id, action) => catalog.prepare({ action, id })}
      preparingAgentId={catalog.preparingAgentId}
      withDocuments={props.withDocuments}
    />
  );
}
