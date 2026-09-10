/** The Agent conversation surface: the transcript, the connection strip that
 *  explains a stopped session, and the composer beneath them. The workspace
 *  only reads session state and hands verbs back to the runtime; every
 *  decision about what a connection means is a domain selector. */
import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import type { QueuedMessage } from '@/components/ui/input-message';
import type { Agent } from '@/features/agent/domain/agent-catalog';
import { changedSource } from '@/features/agent/domain/file-change';
import {
  agentSkills,
  agentTurnIsActive,
  scopeLabel,
  type AgentConnection,
} from '@/features/agent/domain/session';
import { suggestStarters } from '@/features/agent/domain/starters';
import { useAgentCatalog } from '@/features/agent/hooks/use-agent-catalog';
import { focusRing } from '@/lib/focus-ring';
import { cn } from '@/lib/utils';
import { useStickToBottom } from '@/shared/runtime/use-stick-to-bottom';

import { AgentContextComposer } from './composer/context-composer';
import { AgentPermissionMode } from './composer/permission-mode';
import { useAgentInstructions } from '@/features/agent/hooks/use-agent-instructions';

import { AgentComposerSettings } from './composer/settings';
import { AgentInstructionsControl } from './instructions/agent-instructions-control';
import { AgentSetup } from './setup';
import { AgentTranscript } from './transcript/transcript';
import type { AgentWorkspaceProps } from './workspace-lazy';

/** What the status strip under the transcript says, or null when a working
 *  connection needs no explanation. `settled` marks a connection that has
 *  stopped for good rather than one still moving. */
function connectionNotice(connection: AgentConnection): { settled: boolean; text: string } | null {
  switch (connection.kind) {
    case 'draft':
    case 'restoring':
    case 'connecting':
    case 'reconnecting':
    case 'live':
      return null;
    case 'closed':
      return { settled: true, text: connection.message ?? 'Disconnected' };
    case 'failed':
      return { settled: true, text: connection.message };
    case 'retired':
      return { settled: true, text: 'Folder removed · transcript preserved' };
    case 'disposed':
      return { settled: true, text: 'Conversation closed' };
    default: {
      const unreachable: never = connection;
      return unreachable;
    }
  }
}

function ReadyWorkspace({
  agents,
  instructions: instructionsApi,
  readyAgent,
  onOpenExternal,
  onOpenSource,
  onReprocess,
  runtime,
  scopeOutline,
}: Omit<AgentWorkspaceProps, 'catalog' | 'onOpenAgentSettings'> & {
  agents: Agent[];
  readyAgent: Agent;
}) {
  const activeId = useStore(runtime.store, (state) => state.activeId);
  const scopeEnvironment = useStore(runtime.store, (state) => state.scopeEnvironment);
  const active = runtime.session(activeId) ?? runtime.activeSession();
  const state = useStore(
    active.store,
    useShallow((session) => ({
      agent: session.agent,
      accessMode: session.accessMode,
      activeModel: session.activeModel,
      connection: session.connection,
      effort: session.effort,
      model: session.model,
      models: session.models,
      nativeSessionId: session.nativeSessionId,
      queuedPrompts: session.queuedPrompts,
      scope: session.scope,
      skill: session.skill,
      skillCatalog: session.skillCatalog,
      transcript: session.transcript,
    })),
  );
  // The session store is the live authority on the agent (a provider switch
  // remounts the session under the same tab); the parent's match is the
  // fallback for the render in which the two have not met yet.
  const activeAgent = agents.find((agent) => agent.id === state.agent) ?? readyAgent;
  const activeTurn = agentTurnIsActive(state.connection);
  const notice = connectionNotice(state.connection);
  const armedSkill = agentSkills(state.skillCatalog).find((skill) => skill.id === state.skill);
  const empty = state.transcript.length === 0;
  const scopeName = scopeLabel(state.scope);
  const instructions = useAgentInstructions(instructionsApi, state.scope);
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
        aria-busy={activeTurn}
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
              activeTurn={activeTurn}
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

      {notice && (
        <div className="mx-auto flex w-full max-w-[46rem] shrink-0 items-center gap-2 px-5 pb-2 text-caption text-muted-foreground max-sm:px-4">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              notice.settled ? 'bg-decision' : 'bg-working',
            )}
          />
          <span>{notice.text}</span>
          {(state.connection.kind === 'closed' || state.connection.kind === 'failed') && (
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

      {state.connection.kind !== 'retired' && state.connection.kind !== 'disposed' && (
        <div className="relative shrink-0 px-4 pb-3 max-sm:px-3">
          <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-surface-2 to-transparent" />
          <div className="@container relative mx-auto w-full max-w-[46rem]" ref={composerRef}>
            <AgentContextComposer
              attachments={activeAgent.abilities.attachments}
              environment={scopeEnvironment}
              maxRows={6}
              minRows={3}
              onQueueChange={(queue: QueuedMessage[]) =>
                active.setQueue(queue.map(({ id, text }) => ({ id, text })))
              }
              onRefreshSkills={active.refreshSkills}
              onReprocess={onReprocess}
              onSkillChange={active.setSkill}
              onStop={active.interrupt}
              // An armed skill says what it wants next, so its hint replaces
              // the scope prompt.
              placeholder={armedSkill?.argumentHint ?? `Ask about ${scopeName}…`}
              queue={state.queuedPrompts.map(({ context, id, text }) => ({
                files: context.flatMap((item) =>
                  item.kind === 'transient' ? (active.fileForTransient(item.path) ?? []) : [],
                ),
                id,
                text,
              }))}
              leftSlot={
                <>
                <AgentComposerSettings
                  activeAgent={activeAgent}
                  agents={agents}
                  onAgentChange={(agent) => {
                    if (agent !== state.agent) runtime.newChat(agent, state.scope);
                  }}
                  onEffortChange={active.setEffort}
                  onModelChange={active.setModel}
                  onRequestCatalog={active.start}
                  state={{ ...state, activeTurn }}
                />
                <AgentInstructionsControl editor={instructions} scopeName={scopeName} />
                </>
              }
              rightSlot={
                activeAgent.abilities.modes ? (
                  <AgentPermissionMode mode={state.accessMode} onChange={active.setAccessMode} />
                ) : null
              }
              session={active}
              skills={activeAgent.abilities.skills}
              status={activeTurn ? 'streaming' : 'idle'}
            />
          </div>
        </div>
      )}
      {empty && starters.length > 0 && (
        <div className="mx-auto flex w-full max-w-[46rem] shrink-0 flex-wrap gap-2 px-4 pb-3 max-sm:px-3">
          {starters.map((starter) => (
            <button
              className={cn(
                'h-7 cursor-pointer rounded-full border border-border px-3 text-[13px] text-muted-foreground transition-colors duration-fast outline-none hover:bg-surface-3 hover:text-foreground',
                focusRing(),
              )}
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

  const activeAgent = catalog.readyAgents.find((agent) => agent.id === activeAgentId);
  if (activeAgent) {
    return <ReadyWorkspace {...props} agents={catalog.readyAgents} readyAgent={activeAgent} />;
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
