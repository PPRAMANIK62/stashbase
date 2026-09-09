import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import type { QueuedMessage } from '@/components/ui/input-message';
import { changedSource } from '@/features/agent/domain/file-change';
import { scopeLabel, type AgentSessionPhase } from '@/features/agent/domain/session';
import { suggestStarters } from '@/features/agent/domain/starters';
import { useAgentCatalog } from '@/features/agent/hooks/use-agent-catalog';
import { useStickToBottom } from '@/hooks/use-stick-to-bottom';
import { cn } from '@/lib/utils';
import type { Agent } from '@/shared/agent-runtime';

import { AgentContextComposer } from './composer/context-composer';
import { AgentPermissionMode } from './composer/permission-mode';
import { AgentComposerSettings } from './composer/settings';
import { AgentSetup } from './setup';
import { AgentTranscript } from './transcript/transcript';
import type { AgentWorkspaceProps } from './workspace-lazy';

function phaseLabel(phase: AgentSessionPhase, error: string | null): string {
  switch (phase) {
    case 'draft':
      return '';
    case 'restoring':
    case 'connecting':
    case 'live':
      return '';
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
  onOpenExternal,
  onOpenSource,
  onReprocess,
  runtime,
  scopeOutline,
}: Omit<AgentWorkspaceProps, 'catalog' | 'onOpenAgentSettings'> & { agents: Agent[] }) {
  const activeId = useStore(runtime.store, (state) => state.activeId);
  const scopeEnvironment = useStore(runtime.store, (state) => state.scopeEnvironment);
  const active = runtime.session(activeId) ?? runtime.activeSession();
  const state = useStore(
    active.store,
    useShallow((session) => ({
      agent: session.agent,
      accessMode: session.accessMode,
      activeTurn: session.activeTurn,
      activeModel: session.activeModel,
      error: session.error,
      effort: session.effort,
      model: session.model,
      models: session.models,
      nativeSessionId: session.nativeSessionId,
      phase: session.phase,
      queuedPrompts: session.queuedPrompts,
      scope: session.scope,
      transcript: session.transcript,
    })),
  );
  const activeAgent = agents.find((agent) => agent.id === state.agent)!;
  const empty = state.transcript.length === 0;
  const scopeName = scopeLabel(state.scope);
  const starters = useMemo(
    () => (scopeOutline ? suggestStarters(scopeName, scopeOutline) : []),
    [scopeName, scopeOutline],
  );
  const scope = state.scope;
  const sourceFor = useMemo(() => (path: string) => changedSource(scope, path), [scope]);
  const composerRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useStickToBottom(logRef, activeId);
  const prefill = (prompt: string) => {
    active.setDraft(prompt);
    composerRef.current?.querySelector<HTMLElement>('textarea, [contenteditable="true"]')?.focus();
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-surface-2">
      {empty && <div aria-hidden className="min-h-0 grow basis-0" />}
      <div
        aria-busy={state.activeTurn}
        aria-live="polite"
        aria-label="Conversation transcript"
        className={cn('min-h-0 overflow-y-auto', empty ? 'flex-initial' : 'flex-1')}
        ref={logRef}
        role="log"
      >
        <div
          className={cn(
            'mx-auto flex min-h-full w-full max-w-[46rem] flex-col gap-3',
            empty ? 'px-4 pt-8 pb-7 max-sm:px-3' : 'px-5 pt-8 pb-6 max-sm:px-4',
          )}
        >
          {empty ? (
            <h2 className="text-[28px] leading-none font-semibold tracking-[-0.03em] text-foreground max-sm:text-[24px]">
              What should we work on?
            </h2>
          ) : (
            <AgentTranscript
              activeTurn={state.activeTurn}
              blocks={state.transcript}
              key={activeId}
              onOpenExternal={onOpenExternal}
              onOpenSource={onOpenSource}
              onPermission={active.replyPermission}
              onRetry={active.retry}
              sourceFor={sourceFor}
              transientFile={active.fileForTransient}
            />
          )}
        </div>
      </div>

      {phaseLabel(state.phase, state.error) !== '' && (
        <div className="mx-auto flex w-full max-w-[46rem] shrink-0 items-center gap-2 px-5 pb-2 text-caption text-muted-foreground max-sm:px-4">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              state.phase === 'closed' || state.phase === 'retired' ? 'bg-decision' : 'bg-working',
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
        </div>
      )}

      {state.phase !== 'retired' && state.phase !== 'disposed' && (
        <div className="relative shrink-0 px-4 pb-3 max-sm:px-3">
          <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-surface-2 to-transparent" />
          <div className="@container relative mx-auto w-full max-w-[46rem]" ref={composerRef}>
            <AgentContextComposer
              attachments={activeAgent.capabilities?.attachments === true}
              environment={scopeEnvironment}
              maxRows={6}
              minRows={3}
              onQueueChange={(queue: QueuedMessage[]) =>
                active.setQueue(queue.map(({ id, text }) => ({ id, text })))
              }
              onReprocess={onReprocess}
              onStop={active.interrupt}
              placeholder={`Ask about ${scopeName}…`}
              queue={state.queuedPrompts.map(({ context, id, text }) => ({
                files: context.flatMap((item) =>
                  item.kind === 'transient' ? (active.fileForTransient(item.path) ?? []) : [],
                ),
                id,
                text,
              }))}
              leftSlot={
                <AgentComposerSettings
                  activeAgent={activeAgent}
                  agents={agents}
                  onAgentChange={(agent) => {
                    if (agent !== state.agent) runtime.newChat(agent, state.scope);
                  }}
                  onEffortChange={active.setEffort}
                  onModelChange={active.setModel}
                  onRequestCatalog={active.start}
                  state={state}
                />
              }
              rightSlot={
                activeAgent.capabilities?.modes !== false ? (
                  <AgentPermissionMode mode={state.accessMode} onChange={active.setAccessMode} />
                ) : null
              }
              session={active}
              status={state.activeTurn ? 'streaming' : 'idle'}
            />
          </div>
        </div>
      )}
      {empty && starters.length > 0 && (
        <div className="mx-auto flex w-full max-w-[46rem] shrink-0 flex-wrap gap-2 px-4 pb-3 max-sm:px-3">
          {starters.map((starter) => (
            <button
              className="h-7 cursor-pointer rounded-full border border-border px-3 text-[13px] text-muted-foreground transition-colors duration-80 outline-none hover:bg-surface-3 hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
              key={starter.id}
              onClick={() => prefill(starter.prompt)}
              type="button"
            >
              {starter.label}
            </button>
          ))}
        </div>
      )}
      {empty && <div aria-hidden className="min-h-0 grow-[1.3] basis-0" />}
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
    />
  );
}
