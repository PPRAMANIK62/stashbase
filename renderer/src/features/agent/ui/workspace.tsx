/** The Agent conversation surface: the transcript, the connection strip that
 *  explains a stopped session, and the composer beneath them. The workspace
 *  only reads session state and hands verbs back to the runtime; every
 *  decision about what a connection means is a domain selector. */
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import type { QueuedMessage } from '@/components/ui/input-message';
import type { AgentCatalogPort } from '@/features/agent/application/ports';
import { honoredAccessMode } from '@/features/agent/domain/access';
import { agentGate, type Agent } from '@/features/agent/domain/agent-catalog';
import { changedSource } from '@/features/agent/domain/file-change';
import {
  agentSkills,
  agentTurnIsActive,
  scopeLabel,
  type AgentConnection,
  type AgentId,
} from '@/features/agent/domain/session';
import { emptyChatPrompts } from '@/features/agent/domain/starters';
import { useAgentCatalog } from '@/features/agent/hooks/use-agent-catalog';
import { useAgentInstructions } from '@/features/agent/hooks/use-agent-instructions';
import { useRenameConversation } from '@/features/agent/hooks/use-conversation-history';
import { useRotatingPrompt } from '@/features/agent/hooks/use-rotating-prompt';
import { cn } from '@/lib/utils';
import { useStickToBottom } from '@/shared/runtime/use-stick-to-bottom';

import { ChatHeader } from './chat-header';
import { AgentContextComposer } from './composer/context-composer';
import { useAgentComposerFocused } from './composer/focus';
import { AgentPermissionMode } from './composer/permission-mode';
import { AgentProviderControl } from './composer/provider';
import { AgentThinkingControl } from './composer/thinking';
import { AgentInstructionsControl } from './instructions/agent-instructions-control';
import { NewChatButton } from './new-chat-button';
import { AgentSetupNotice } from './setup';
import { AgentTranscript } from './transcript/transcript';
import type { AgentWorkspaceProps } from './workspace-lazy';

/** What the status strip under the transcript says, or null when a working
 *  connection needs no explanation. `settled` marks a connection that has
 *  stopped for good rather than one still moving. */
/** What the conversation needs to know about the runtimes this window can
 *  reach: which exist, which can carry a turn, and how to prepare one. */
interface WorkspaceCatalog {
  agents: Agent[];
  error: boolean;
  loading: boolean;
  prepare(id: AgentId, action: 'bootstrap' | 'login'): void;
  preparingAgentId: AgentId | undefined;
  readyAgents: Agent[];
}

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

/** The conversation surface, whether or not a runtime can carry a turn yet.
 *  A gated window is the same canvas with the agent-specific controls absent,
 *  an unsendable composer, and the setup notice beneath it — not a second
 *  screen that replaces the draft. */
function ChatWorkspace({
  catalog,
  catalogPort,
  instructions: instructionsApi,
  onOpenAgentSettings,
  onOpenExternal,
  onOpenSource,
  onReprocess,
  runtime,
  scopeOutline,
}: Omit<AgentWorkspaceProps, 'catalog'> & {
  catalog: WorkspaceCatalog;
  /** The catalog as a Port, for the new-chat control that reads it itself. */
  catalogPort: AgentCatalogPort;
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
  // The gate is decided from this component's own store read. A provider
  // switch remounts the session under the same tab, which leaves the id — and
  // so a parent that only watches the id — unchanged; deciding here is what
  // keeps the gate and the session's runtime from disagreeing.
  const gate = agentGate({
    agents: catalog.agents,
    loading: catalog.loading,
    selected: state.agent,
  });
  // Null is a window with nothing ready: the composer still takes a draft, and
  // advertises no ability it cannot currently deliver.
  const readyAgent = gate.kind === 'ready' ? gate.agent : null;
  const activeTurn = agentTurnIsActive(state.connection);
  const notice = connectionNotice(state.connection);
  const armedSkill = agentSkills(state.skillCatalog).find((skill) => skill.id === state.skill);
  const empty = state.transcript.length === 0;
  const scopeName = scopeLabel(state.scope);
  const instructions = useAgentInstructions(instructionsApi, state.scope);
  // A mode is a promise the runtime must be able to keep. A session that
  // lands on a runtime honoring a different set settles on one it does
  // honor before the next turn binds it; a runtime honoring none takes no
  // mode, so nothing is sent for it.
  const honoredModes = readyAgent?.abilities.modes;
  useEffect(() => {
    if (!honoredModes || honoredModes.length === 0) return;
    const settled = honoredAccessMode(honoredModes, state.accessMode);
    if (settled !== state.accessMode) active.setAccessMode(settled);
  }, [active, honoredModes, state.accessMode]);
  // A fresh chat names what it will run on from the catalog the service
  // remembers for its runtime; once the session starts, the socket's own
  // catalog takes over and the seed is refused.
  const rememberedModels = readyAgent?.models;
  const unstarted = state.connection.kind === 'draft';
  useEffect(() => {
    if (unstarted && rememberedModels && rememberedModels.length > 0) {
      active.seedModels(rememberedModels);
    }
  }, [active, rememberedModels, unstarted]);
  const prompts = useMemo(
    () => (scopeOutline ? emptyChatPrompts(scopeName, scopeOutline) : []),
    [scopeName, scopeOutline],
  );
  // The blank Chat's placeholder cycles through the three requests, holding
  // still while the reader is on the field. An armed skill's own hint and a
  // conversation already under way take the field back.
  const composerFocused = useAgentComposerFocused();
  const rotatingPrompt = useRotatingPrompt(prompts, composerFocused || !empty);
  const promptPlaceholder = empty && armedSkill === undefined ? rotatingPrompt : null;
  const scope = state.scope;
  const sourceFor = useMemo(() => (path: string) => changedSource(scope, path), [scope]);
  const composerRef = useRef<HTMLDivElement>(null);
  const composerShown = state.connection.kind !== 'retired' && state.connection.kind !== 'disposed';
  // The editor takes the returned text on its next render, so focus follows
  // a frame later and the caret lands after it.
  const editPrompt = useCallback(
    (blockId: string) => {
      if (!active.editPrompt(blockId)) return;
      requestAnimationFrame(() => {
        composerRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
      });
    },
    [active],
  );
  const logRef = useRef<HTMLDivElement>(null);
  useStickToBottom(logRef, activeId);
  const renaming = useRenameConversation(runtime);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-surface-2">
      <ChatHeader
        failure={renaming.failure}
        onRename={(session, title) => void renaming.rename(session, title)}
        session={active}
        // New chat sits with the conversation's name: the row is where the
        // current Chat's own actions live, while the Chats panel keeps the
        // history.
        trailing={<NewChatButton catalog={catalogPort} runtime={runtime} scope={state.scope} />}
      />
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
            empty ? 'px-4 pt-8 pb-7 max-sm:px-3' : 'px-5 pt-4 pb-6 max-sm:px-4',
          )}
        >
          {empty ? (
            // The one line that says what this space is for, and in which
            // order: a wiki is built from the folder first, and the writing
            // comes from it. `design-docs` calls it durable, so it is not a
            // generic chat prompt to be reworded, and it claims nothing about
            // whose the words are.
            <h2 className="text-center text-[28px] leading-none font-semibold tracking-[-0.03em] text-foreground max-sm:text-[24px]">
              From wiki to words.
            </h2>
          ) : (
            <AgentTranscript
              activeTurn={activeTurn}
              blocks={state.transcript}
              key={activeId}
              onEditPrompt={composerShown ? editPrompt : undefined}
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

      {composerShown && (
        <div className="relative shrink-0 px-4 pb-3 max-sm:px-3">
          <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-surface-2 to-transparent" />
          <div className="@container relative mx-auto w-full max-w-[46rem]" ref={composerRef}>
            <AgentContextComposer
              attachments={readyAgent?.abilities.attachments ?? false}
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
              // the cycling request; a conversation under way gets the plain
              // prompt.
              placeholder={armedSkill?.argumentHint ?? promptPlaceholder ?? 'Ask or write…'}
              placeholderIsPrompt={promptPlaceholder !== null}
              queue={state.queuedPrompts.map(({ context, id, text }) => ({
                files: context.flatMap((item) =>
                  item.kind === 'transient' ? (active.fileForTransient(item.path) ?? []) : [],
                ),
                id,
                text,
              }))}
              // The left cluster is who runs the turn and under what rules;
              // the right is what it runs on, read last before Send.
              leftSlot={
                <>
                  {readyAgent && (
                    <AgentProviderControl
                      activeAgent={readyAgent}
                      agents={catalog.readyAgents}
                      disabled={activeTurn}
                      onAgentChange={(agent) => {
                        if (agent !== state.agent) runtime.newChat(agent, state.scope);
                      }}
                    />
                  )}
                  {readyAgent && readyAgent.abilities.modes.length > 0 && (
                    <AgentPermissionMode
                      mode={state.accessMode}
                      modes={readyAgent.abilities.modes}
                      onChange={active.setAccessMode}
                    />
                  )}
                  <AgentInstructionsControl editor={instructions} scopeName={scopeName} />
                </>
              }
              rightSlot={
                readyAgent ? (
                  <AgentThinkingControl
                    activeAgent={readyAgent}
                    onEffortChange={active.setEffort}
                    onModelChange={active.setModel}
                    onRequestCatalog={active.start}
                    state={{ ...state, activeTurn }}
                  />
                ) : null
              }
              sendable={readyAgent !== null}
              session={active}
              skills={readyAgent?.abilities.skills ?? false}
              status={activeTurn ? 'streaming' : 'idle'}
            />
          </div>
        </div>
      )}
      {gate.kind !== 'ready' && (
        // One call to action at a time: while no runtime can carry a turn,
        // the gate sits where the composer's own requests would otherwise be
        // the only thing on offer.
        <AgentSetupNotice
          checking={gate.kind === 'checking'}
          error={catalog.error}
          onOpenSettings={onOpenAgentSettings}
          onPrepare={catalog.prepare}
          pending={gate.kind === 'setup' ? gate.pending : []}
          preparingAgentId={catalog.preparingAgentId}
        />
      )}
      {empty && <div aria-hidden className="min-h-0 grow-[1.3] basis-0" />}
    </div>
  );
}

export default function ManagedAgentWorkspace(props: AgentWorkspaceProps) {
  const catalog = useAgentCatalog(props.catalog);

  useEffect(() => {
    props.runtime.start(catalog.readyAgents.map((agent) => agent.id));
  }, [catalog.readyAgents, props.runtime]);

  return (
    <ChatWorkspace
      {...props}
      catalogPort={props.catalog}
      catalog={{
        agents: catalog.agents,
        error: catalog.error,
        loading: catalog.loading,
        prepare: (id, action) => catalog.prepare({ action, id }),
        preparingAgentId: catalog.preparingAgentId,
        readyAgents: catalog.readyAgents,
      }}
    />
  );
}
