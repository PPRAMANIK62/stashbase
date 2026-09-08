import { createStore, type StoreApi } from 'zustand/vanilla';

import type {
  AgentConnection,
  AgentReconnectScheduler,
  AgentSessionPort,
} from '@/features/agent/application/ports';
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import {
  agentSessionIsBlank,
  createAgentSessionState,
  transitionAgentSession,
  type AgentId,
  type AgentScope,
  type AgentSessionState,
} from '@/features/agent/domain/session';
import type { AgentAccessMode } from '@/protocols/websocket/agent-session';

const RECONNECT_DELAYS_MS = [250, 1_000, 3_000] as const;

export interface AgentSessionRuntime {
  readonly id: string;
  readonly signal: AbortSignal;
  readonly store: StoreApi<AgentSessionState>;
  isBlank(): boolean;
  interrupt(): boolean;
  replyPermission(
    toolUseId: string,
    permissionId: string,
    allow: boolean,
    always?: boolean,
  ): boolean;
  rename(title: string): void;
  reconnect(): void;
  retry(errorBlockId: string): boolean;
  sendPrompt(text?: string): boolean;
  setAccessMode(mode: AgentAccessMode): void;
  setEffort(effort: string | null): void;
  setModel(model: string | null): void;
  setDraft(draft: string): void;
  setQueue(queue: Array<{ id: string; text: string }>): void;
  restore(entry: AgentHistoryEntry, connectWhenReady?: boolean): Promise<boolean>;
  retire(folderPath: string): void;
  start(): void;
  dispose(): void;
}

export interface AgentSessionRuntimeOptions {
  agent: AgentId;
  autostart?: boolean;
  id: string;
  port: AgentSessionPort;
  scheduler?: AgentReconnectScheduler;
  scope: AgentScope;
  title?: string;
}

function defaultScheduler(): AgentReconnectScheduler {
  return {
    jitter(delayMs) {
      return Math.round(delayMs * (0.85 + Math.random() * 0.3));
    },
    wait(delayMs, signal) {
      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        const timeout = setTimeout(resolve, delayMs);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeout);
            reject(signal.reason);
          },
          { once: true },
        );
      });
    },
  };
}

function latestUserPrompt(state: AgentSessionState): string | undefined {
  for (let index = state.transcript.length - 1; index >= 0; index -= 1) {
    const block = state.transcript[index];
    if (block?.kind === 'user') return block.text;
  }
  return undefined;
}

export function createAgentSessionRuntime({
  agent,
  autostart = true,
  id,
  port,
  scheduler = defaultScheduler(),
  scope,
  title,
}: AgentSessionRuntimeOptions): AgentSessionRuntime {
  const controller = new AbortController();
  const store = createStore<AgentSessionState>(() =>
    createAgentSessionState({ agent, id, scope, title }),
  );
  let disposed = false;
  let connection: AgentConnection | null = null;
  let connectionGeneration = 0;
  let operationGeneration = 0;
  let closeExpected = false;
  let exitReceived = false;
  let started = false;
  let blockSequence = 0;
  let pendingPrompt: string | null = null;
  let appliedAccessMode: AgentAccessMode | null = null;

  const nextBlockId = (kind: string) => `${id}-${kind}-${++blockSequence}`;

  const transition = (action: Parameters<typeof transitionAgentSession>[1]) => {
    store.setState((state) => transitionAgentSession(state, action), true);
  };

  const closeConnection = () => {
    closeExpected = true;
    connection?.close();
    connection = null;
  };

  const scheduleReconnect = (capturedGeneration: number) => {
    const state = store.getState();
    const attempt = state.reconnectAttempt + 1;
    if (attempt > RECONNECT_DELAYS_MS.length) {
      transition({
        message: 'Agent connection was interrupted. Reconnect to continue this conversation.',
        type: 'fail',
      });
      return;
    }
    transition({ attempt, type: 'schedule-reconnect' });
    const delay = scheduler.jitter(RECONNECT_DELAYS_MS[attempt - 1]);
    void scheduler.wait(delay, controller.signal).then(
      () => {
        if (disposed || controller.signal.aborted || capturedGeneration !== connectionGeneration) {
          return;
        }
        startConnection(store.getState().nativeSessionId ?? undefined);
      },
      () => undefined,
    );
  };

  const startConnection = (resume?: string) => {
    if (disposed) return;
    started = true;
    closeConnection();
    const capturedGeneration = ++connectionGeneration;
    closeExpected = false;
    exitReceived = false;
    const state = store.getState();
    const connectedAccessMode = state.accessMode;
    appliedAccessMode = connectedAccessMode;
    transition({ type: 'connect' });
    try {
      connection = port.connect(
        {
          access: connectedAccessMode,
          agent: state.agent,
          effort: state.effort ?? undefined,
          model: state.model ?? undefined,
          resume,
          scope: state.scope,
        },
        {
          onClose() {
            if (
              disposed ||
              closeExpected ||
              exitReceived ||
              capturedGeneration !== connectionGeneration
            ) {
              return;
            }
            scheduleReconnect(capturedGeneration);
          },
          onInvalidResponse() {
            if (disposed || capturedGeneration !== connectionGeneration) return;
            closeExpected = true;
            connection?.close();
            transition({ message: 'Agent returned an invalid response.', type: 'fail' });
          },
          onEvent(event) {
            if (disposed || capturedGeneration !== connectionGeneration) return;
            switch (event.kind) {
              case 'ready':
                transition({ type: 'ready' });
                if (store.getState().accessMode !== appliedAccessMode) {
                  const nextMode = store.getState().accessMode;
                  if (connection?.send?.({ mode: nextMode, t: 'set-mode' })) {
                    appliedAccessMode = nextMode;
                  }
                }
                if (pendingPrompt) {
                  const prompt = pendingPrompt;
                  pendingPrompt = null;
                  if (connection?.send?.({ t: 'prompt', text: prompt })) {
                    transition({
                      at: Date.now(),
                      id: nextBlockId('user'),
                      text: prompt,
                      type: 'submit-prompt',
                    });
                  } else {
                    transition({ draft: prompt, type: 'set-draft' });
                  }
                }
                break;
              case 'identified':
                transition({ id: event.id, type: 'identify' });
                break;
              case 'titled':
                transition({ title: event.title, type: 'title' });
                break;
              case 'scope-changed':
                transition({ scope: event.scope, type: 'change-scope' });
                break;
              case 'models':
                transition({
                  activeModel: event.activeModel,
                  fallback: event.fallback,
                  models: event.models,
                  type: 'set-model-catalog',
                });
                if (event.fallback) {
                  transition({
                    id: nextBlockId('notice'),
                    message: event.fallback,
                    type: 'append-notice',
                  });
                }
                break;
              case 'turn-started':
                transition({ type: 'turn-start' });
                break;
              case 'text':
                transition({ delta: event.delta, id: nextBlockId('reply'), type: 'append-text' });
                break;
              case 'thinking':
                transition({
                  delta: event.delta,
                  id: nextBlockId('thinking'),
                  type: 'append-thinking',
                });
                break;
              case 'tool-started':
                transition({
                  id: event.id,
                  input: event.input,
                  name: event.name,
                  type: 'start-tool',
                });
                break;
              case 'tool-output':
                transition({ delta: event.delta, id: event.id, type: 'append-tool-output' });
                break;
              case 'tool-finished':
                transition({
                  content: event.content,
                  id: event.id,
                  isError: event.isError,
                  type: 'finish-tool',
                });
                break;
              case 'permission-requested':
                transition({
                  id: event.id,
                  input: event.input,
                  name: event.name,
                  title: event.title,
                  toolUseId: event.toolUseId,
                  type: 'request-permission',
                });
                break;
              case 'turn-ended':
                transition({ isError: event.isError, type: 'turn-end' });
                break;
              case 'notice':
                transition({
                  id: nextBlockId('notice'),
                  message: event.message,
                  type: 'append-notice',
                });
                break;
              case 'failed':
                if (store.getState().phase === 'live') {
                  const prompt = latestUserPrompt(store.getState());
                  transition({
                    failure: event.failure,
                    id: nextBlockId('error'),
                    message: event.message,
                    retryablePrompt: prompt,
                    type: 'turn-fail',
                  });
                } else {
                  transition({ message: event.message, type: 'fail' });
                }
                break;
              case 'exited':
                exitReceived = true;
                closeExpected = true;
                transition({ message: event.message, type: 'close' });
                connection?.close();
                break;
              case 'scope-retired':
                exitReceived = true;
                closeExpected = true;
                transition({
                  scope: { kind: 'folder', path: event.folderPath },
                  type: 'change-scope',
                });
                transition({ type: 'retire' });
                connection?.close();
                break;
            }
          },
        },
      );
    } catch {
      transition({ message: 'Agent connection could not start.', type: 'fail' });
    }
  };

  const runtime: AgentSessionRuntime = {
    id,
    signal: controller.signal,
    store,
    isBlank() {
      return agentSessionIsBlank(store.getState());
    },
    interrupt() {
      if (disposed || !store.getState().activeTurn) return false;
      return connection?.send?.({ t: 'interrupt' }) ?? false;
    },
    replyPermission(toolUseId, permissionId, allow, always) {
      if (disposed) return false;
      const tool = store
        .getState()
        .transcript.find((block) => block.kind === 'tool' && block.id === toolUseId);
      if (
        tool?.kind !== 'tool' ||
        tool.permissionId !== permissionId ||
        tool.status !== 'awaiting'
      ) {
        return false;
      }
      const sent =
        connection?.send?.({ allow, always, id: permissionId, t: 'permission-reply' }) ?? false;
      if (sent) transition({ allow, toolUseId, type: 'reply-permission' });
      return sent;
    },
    rename(nextTitle) {
      if (!disposed) transition({ title: nextTitle, type: 'title' });
    },
    reconnect() {
      if (disposed || store.getState().phase === 'retired') return;
      transition({ type: 'reset-reconnect' });
      startConnection(store.getState().nativeSessionId ?? undefined);
    },
    retry(errorBlockId) {
      if (disposed || store.getState().activeTurn) return false;
      const failure = store
        .getState()
        .transcript.find((block) => block.kind === 'error' && block.id === errorBlockId);
      if (failure?.kind !== 'error' || !failure.retryablePrompt) return false;
      if (store.getState().phase !== 'live') return false;
      const sent = connection?.send?.({ t: 'prompt', text: failure.retryablePrompt }) ?? false;
      if (sent) {
        transition({ id: errorBlockId, type: 'settle-error' });
        transition({ type: 'turn-start' });
      }
      return sent;
    },
    sendPrompt(text = store.getState().draft) {
      if (disposed || store.getState().activeTurn) return false;
      const prompt = text.trim();
      if (!prompt) return false;
      if (store.getState().phase === 'draft') {
        pendingPrompt = prompt;
        transition({ draft: prompt, type: 'set-draft' });
        runtime.start();
        return true;
      }
      if (store.getState().phase !== 'live') return false;
      const sent = connection?.send?.({ t: 'prompt', text: prompt }) ?? false;
      if (sent) {
        transition({
          at: Date.now(),
          id: nextBlockId('user'),
          text: prompt,
          type: 'submit-prompt',
        });
      }
      return sent;
    },
    setAccessMode(mode) {
      if (disposed || store.getState().accessMode === mode) return;
      transition({ mode, type: 'set-access-mode' });
      if (connection?.send?.({ mode, t: 'set-mode' })) appliedAccessMode = mode;
    },
    setEffort(effort) {
      const state = store.getState();
      if (disposed || state.activeTurn || state.effort === effort) return;
      const selectedModel = state.models.find(
        (model) => model.id === (state.model ?? state.activeModel),
      );
      if (effort && !selectedModel?.supportedEfforts?.includes(effort)) return;
      transition({ effort, type: 'set-effort' });
      if (started) startConnection(state.nativeSessionId ?? undefined);
    },
    setModel(model) {
      const state = store.getState();
      if (
        disposed ||
        state.activeTurn ||
        state.model === model ||
        (model !== null && !state.models.some((entry) => entry.id === model))
      ) {
        return;
      }
      const nextModel = state.models.find((entry) => entry.id === model);
      const nextEffort =
        state.effort && !nextModel?.supportedEfforts?.includes(state.effort) ? null : state.effort;
      transition({ model, type: 'set-model' });
      if (nextEffort !== state.effort) transition({ effort: nextEffort, type: 'set-effort' });
      connection?.send?.({ ...(model ? { model } : {}), t: 'set-model' });
    },
    setDraft(draft) {
      if (!disposed) transition({ draft, type: 'set-draft' });
    },
    setQueue(queue) {
      if (!disposed) transition({ queue, type: 'set-queue' });
    },
    async restore(entry, connectWhenReady = true) {
      if (disposed) return false;
      const operation = ++operationGeneration;
      closeConnection();
      transition({ title: entry.title, type: 'begin-restore' });
      try {
        const replay = await port.replay(entry, controller.signal);
        if (disposed || operation !== operationGeneration) return false;
        transition({
          effort: replay.effort,
          lastModified: entry.lastModified,
          nativeSessionId: entry.id,
          transcript: replay.transcript,
          type: 'restore',
        });
        if (connectWhenReady) startConnection(entry.id);
        else transition({ message: null, type: 'close' });
        return true;
      } catch {
        if (disposed || operation !== operationGeneration) return false;
        transition({ message: 'That conversation could not be restored.', type: 'fail' });
        return false;
      }
    },
    retire(folderPath) {
      if (disposed) return;
      const state = store.getState();
      if (state.scope.kind !== 'folder' || state.scope.path !== folderPath) return;
      operationGeneration += 1;
      connectionGeneration += 1;
      closeConnection();
      transition({ type: 'retire' });
    },
    start() {
      if (disposed || started) return;
      started = true;
      startConnection(store.getState().nativeSessionId ?? undefined);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      operationGeneration += 1;
      connectionGeneration += 1;
      controller.abort();
      closeConnection();
      transition({ type: 'dispose' });
    },
  };

  if (autostart) runtime.start();
  return runtime;
}
