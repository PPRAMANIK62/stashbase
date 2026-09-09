/** One Agent conversation, assembled. The runtime owns the store and the
 *  session's public verbs; the transport, the prompt ledger and the event
 *  applier next to this file own the parts that used to be tangled together
 *  inside it. Work that spans an await captures the scope it started under,
 *  so a completion arriving after the conversation moved folders is refused
 *  instead of being applied to the folder the user is now looking at. */
import { createStore } from 'zustand/vanilla';

import { agentFailure, RESTORE_FAILED } from '@/features/agent/application/failure-messages';
import {
  createAgentTransport,
  createDefaultScheduler,
} from '@/features/agent/application/session/connection';
import {
  createPromptDispatcher,
  unavailableContextPort,
} from '@/features/agent/application/session/dispatch';
import {
  applyAgentSessionEvent,
  type AgentEventContext,
} from '@/features/agent/application/session/events';
import {
  filesChanged,
  type AgentFilesChanged,
} from '@/features/agent/application/session/files-changed';
import {
  createPromptLedger,
  planQueue,
  type PendingPrompt,
} from '@/features/agent/application/session/prompts';
import type {
  AgentSessionRuntime,
  AgentSessionRuntimeOptions,
} from '@/features/agent/application/session/runtime-contract';
import { addContextItem, removeContextItem } from '@/features/agent/domain/context';
import {
  agentScopesEqual,
  agentSessionIsBlank,
  agentTurnIsActive,
  createAgentSessionState,
  transitionAgentSession,
  type AgentSessionState,
} from '@/features/agent/domain/session';
import { createScopeGuard } from '@/lib/runtime/scope-guard';
import { isFeatureError } from '@/shared/domain/feature-error';

export type { AgentFilesChanged };
export type { AgentSessionRuntime, AgentSessionRuntimeOptions } from './session/runtime-contract';

export function createAgentSessionRuntime({
  agent,
  autostart = true,
  context: contextPort = unavailableContextPort(),
  environment = () => null,
  id,
  onFilesChanged,
  port,
  scheduler = createDefaultScheduler(),
  scope,
  title,
}: AgentSessionRuntimeOptions): AgentSessionRuntime {
  const controller = new AbortController();
  const store = createStore<AgentSessionState>(() =>
    createAgentSessionState({ agent, id, scope, title }),
  );
  const ledger = createPromptLedger();
  /** Uploaded Files by their temp path, so tiles can render what was sent. */
  const transientFiles = new Map<string, File>();
  let disposed = false;
  let started = false;
  let blockSequence = 0;

  const state = () => store.getState();
  const { accept, capture, retireOperations } = createScopeGuard({
    disposed: () => disposed,
    sameScope: agentScopesEqual,
    scope: () => state().scope,
  });
  const nextBlockId = (kind: string) => `${id}-${kind}-${++blockSequence}`;
  const transition = (action: Parameters<typeof transitionAgentSession>[1]) => {
    store.setState((current) => transitionAgentSession(current, action), true);
  };

  const notifyFilesChanged = (changed: string[]) => {
    if (!onFilesChanged) return;
    const change = filesChanged(state().scope, changed);
    if (change) onFilesChanged(change);
  };

  /** Sends the wire prompt and records the user's own view of it. */
  const submit = (prompt: PendingPrompt): boolean => {
    const sent = transport.send({
      kind: 'prompt',
      skill: prompt.skill?.id ?? null,
      text: prompt.wire,
    });
    if (!sent) return false;
    const blockId = nextBlockId('user');
    ledger.recordTurn(blockId, { skill: prompt.skill?.id ?? null, wire: prompt.wire });
    transition({
      at: Date.now(),
      context: prompt.context,
      id: blockId,
      // The server composes the skill into the wire prompt, so the
      // transcript states which skill ran beside what was typed.
      text: prompt.skill ? `/${prompt.skill.label} ${prompt.display}`.trimEnd() : prompt.display,
      kind: 'submit-prompt',
    });
    return true;
  };

  const transport = createAgentTransport({
    disposed: () => disposed,
    onEvent: (event) => applyAgentSessionEvent(eventContext, event),
    port,
    scheduler,
    signal: controller.signal,
    state,
    transition,
  });

  const eventContext: AgentEventContext = {
    ledger,
    nextBlockId,
    notifyFilesChanged,
    state,
    submit,
    transition,
    transport,
  };

  const dispatcher = createPromptDispatcher({
    contextPort,
    disposed: () => disposed,
    environment,
    ledger,
    signal: controller.signal,
    start: () => runtime.start(),
    state,
    submit,
    transientFiles,
    transition,
  });

  const runtime: AgentSessionRuntime = {
    id,
    signal: controller.signal,
    store,
    accept,
    capture,
    isBlank() {
      return agentSessionIsBlank(state());
    },
    interrupt() {
      if (disposed || !agentTurnIsActive(state().connection)) return false;
      return transport.send({ kind: 'interrupt' });
    },
    replyPermission(toolUseId, permissionId, allow, always) {
      if (disposed) return false;
      const tool = state().transcript.find(
        (block) => block.kind === 'tool' && block.id === toolUseId,
      );
      if (
        tool?.kind !== 'tool' ||
        tool.permissionId !== permissionId ||
        tool.status !== 'awaiting'
      ) {
        return false;
      }
      const sent = transport.send({
        allow,
        always: always ?? null,
        id: permissionId,
        kind: 'reply-permission',
      });
      if (sent) transition({ allow, toolUseId, kind: 'reply-permission' });
      return sent;
    },
    rename(nextTitle) {
      if (!disposed) transition({ title: nextTitle, kind: 'titled' });
    },
    reconnect() {
      if (disposed || state().connection.kind === 'retired') return;
      started = true;
      transport.open({ attempt: 0, resume: state().nativeSessionId ?? undefined });
    },
    retry(errorBlockId) {
      const current = state();
      if (disposed || agentTurnIsActive(current.connection)) return false;
      const failure = current.transcript.find(
        (block) => block.kind === 'error' && block.id === errorBlockId,
      );
      // A skill-only turn goes out with empty text, so presence — not
      // emptiness — decides whether the failed turn can be resent.
      if (failure?.kind !== 'error' || failure.retryablePrompt === undefined) return false;
      if (current.connection.kind !== 'live') return false;
      const skill = ledger.turnFor(errorBlockId)?.skill ?? null;
      const sent = transport.send({
        kind: 'prompt',
        skill,
        text: failure.retryablePrompt,
      });
      if (sent) {
        transition({ id: errorBlockId, kind: 'settle-error' });
        transition({ kind: 'turn-started' });
      }
      return sent;
    },
    addContext(item) {
      if (disposed) return;
      transition({ context: addContextItem(state().context, item), kind: 'set-context' });
    },
    removeContext(key) {
      if (disposed) return;
      transition({ context: removeContextItem(state().context, key), kind: 'set-context' });
    },
    fileForTransient(path) {
      return transientFiles.get(path);
    },
    attachFiles(files) {
      return dispatcher.attach(files);
    },
    sendPrompt(text = state().draft, options = {}) {
      return dispatcher.send(text, options);
    },
    setAccessMode(mode) {
      if (disposed || state().accessMode === mode) return;
      transition({ mode, kind: 'set-access-mode' });
      transport.applyAccessMode(mode);
    },
    setEffort(effort) {
      const current = state();
      if (disposed || agentTurnIsActive(current.connection) || current.effort === effort) return;
      const selectedModel = current.models.find(
        (model) => model.id === (current.model ?? current.activeModel),
      );
      if (effort && !selectedModel?.supportedEfforts?.includes(effort)) return;
      transition({ effort, kind: 'set-effort' });
      if (started) transport.open({ resume: current.nativeSessionId ?? undefined });
    },
    setModel(model) {
      const current = state();
      if (
        disposed ||
        agentTurnIsActive(current.connection) ||
        current.model === model ||
        (model !== null && !current.models.some((entry) => entry.id === model))
      ) {
        return;
      }
      const nextModel = current.models.find((entry) => entry.id === model);
      const nextEffort =
        current.effort && !nextModel?.supportedEfforts?.includes(current.effort)
          ? null
          : current.effort;
      transition({ model, kind: 'set-model' });
      if (nextEffort !== current.effort) transition({ effort: nextEffort, kind: 'set-effort' });
      transport.send({ kind: 'select-model', model });
    },
    setSkill(skill) {
      if (disposed || state().skill === skill) return;
      transition({ skill, kind: 'set-skill' });
    },
    refreshSkills() {
      if (disposed || state().connection.kind !== 'live') return;
      transport.send({ kind: 'refresh-skills' });
    },
    setDraft(draft) {
      if (!disposed) transition({ draft, kind: 'set-draft' });
    },
    setQueue(queue) {
      if (disposed) return;
      const plan = planQueue(state(), queue);
      transition({ queue: plan.queue, kind: 'set-queue' });
      for (const stashed of plan.stash) ledger.stash(stashed.id, stashed.prompt);
      if (plan.context) transition({ context: plan.context, kind: 'set-context' });
      if (plan.skill !== undefined) transition({ skill: plan.skill, kind: 'set-skill' });
    },
    async restore(entry, connectWhenReady = true) {
      if (disposed) return false;
      // A restore retires whatever was already restoring, then runs under the
      // token it captures — so only the newest replay may land.
      retireOperations();
      const capturedScope = capture();
      transport.close();
      transition({ title: entry.title, kind: 'begin-restore' });
      try {
        const replay = await port.replay(entry, controller.signal);
        return accept(capturedScope, () => {
          transition({
            effort: replay.effort,
            lastModified: entry.lastModified,
            nativeSessionId: entry.id,
            transcript: replay.transcript,
            kind: 'restore',
          });
          if (connectWhenReady) {
            started = true;
            transport.open({ attempt: 0, resume: entry.id });
          } else transition({ message: null, kind: 'close' });
        });
      } catch (cause) {
        // The refusal itself decides the sentence; a rejection that is not on
        // the Agent's ladder keeps the generic restore line.
        const message = isFeatureError(cause) ? agentFailure(cause).message : RESTORE_FAILED;
        accept(capturedScope, () => transition({ message, kind: 'fail' }));
        return false;
      }
    },
    retire(folderPath) {
      if (disposed) return;
      const current = state();
      if (current.scope.kind !== 'folder' || current.scope.path !== folderPath) return;
      retireOperations();
      transport.invalidate();
      ledger.clearStashed();
      transport.close();
      transition({ kind: 'retire' });
    },
    start() {
      if (disposed || started) return;
      started = true;
      transport.open({ resume: state().nativeSessionId ?? undefined });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      retireOperations();
      transport.invalidate();
      ledger.clearStashed();
      transientFiles.clear();
      controller.abort();
      transport.close();
      transition({ kind: 'dispose' });
    },
  };

  if (autostart) runtime.start();
  return runtime;
}
