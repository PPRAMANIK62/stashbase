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

const RECONNECT_DELAYS_MS = [250, 1_000, 3_000] as const;

export interface AgentSessionRuntime {
  readonly id: string;
  readonly signal: AbortSignal;
  readonly store: StoreApi<AgentSessionState>;
  isBlank(): boolean;
  rename(title: string): void;
  reconnect(): void;
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
    transition({ type: 'connect' });
    try {
      connection = port.connect(
        {
          agent: state.agent,
          effort: state.effort ?? undefined,
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
              case 'failed':
                if (store.getState().phase !== 'live') {
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
    rename(nextTitle) {
      if (!disposed) transition({ title: nextTitle, type: 'title' });
    },
    reconnect() {
      if (disposed || store.getState().phase === 'retired') return;
      transition({ type: 'reset-reconnect' });
      startConnection(store.getState().nativeSessionId ?? undefined);
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
