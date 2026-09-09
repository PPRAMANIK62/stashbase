import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  AgentContextError,
  type AgentConnection,
  type AgentContextPort,
  type AgentReconnectScheduler,
  type AgentSessionPort,
} from '@/features/agent/application/ports';
import {
  addContextItem,
  removeContextItem,
  renderPromptContext,
  staleContext,
  validateContext,
  type AgentContextItem,
  type AgentContextReadiness,
  type AgentScopeListing,
  type ResolvedContextLine,
} from '@/features/agent/domain/context';
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import { changedSource, fileChangesForTool } from '@/features/agent/domain/file-change';
import {
  agentSessionIsBlank,
  createAgentSessionState,
  transitionAgentSession,
  type AgentId,
  type AgentQueuedPrompt,
  type AgentScope,
  type AgentSessionState,
} from '@/features/agent/domain/session';
import type { AgentAccessMode } from '@/protocols/websocket/agent-session';
import type { SourceReference } from '@/shared/domain/source-reference';

const RECONNECT_DELAYS_MS = [250, 1_000, 3_000] as const;
const MAX_DEQUEUED = 20;

export type AgentSendResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'busy' | 'disconnected' | 'stale' };

/** What the session can check bound context against without asking the
 *  server: the live listing and preparation state of its own folder. */
export interface AgentSessionEnvironment {
  listing: AgentScopeListing | null;
  readiness: Readonly<Record<string, AgentContextReadiness>>;
}

/** Files a settled tool or native diff left changed under one scope. */
export interface AgentFilesChanged {
  scope: AgentScope;
  /** Every path as the runtime named it. */
  paths: string[];
  /** The ones that resolve to a source inside the scoped folder. */
  sources: SourceReference[];
}

interface PendingPrompt {
  context: AgentContextItem[];
  display: string;
  wire: string;
}

interface DequeuedPrompt {
  context: AgentContextItem[];
  text: string;
}

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
  addContext(item: AgentContextItem): void;
  removeContext(key: string): void;
  /** Uploads transient files and binds each successful one to the draft. */
  attachFiles(files: File[]): Promise<void>;
  /** The File behind an upload bound in this session, for thumbnails. */
  fileForTransient(path: string): File | undefined;
  /** Validates and resolves the bound context, then sends the prompt. A
   *  queued id sends that prompt's own context snapshot. */
  sendPrompt(text?: string, options?: { queuedId?: string }): Promise<AgentSendResult>;
  setAccessMode(mode: AgentAccessMode): void;
  setEffort(effort: string | null): void;
  setModel(model: string | null): void;
  setDraft(draft: string): void;
  setQueue(queue: Array<{ id: string; text: string; context?: AgentContextItem[] }>): void;
  restore(entry: AgentHistoryEntry, connectWhenReady?: boolean): Promise<boolean>;
  retire(folderPath: string): void;
  start(): void;
  dispose(): void;
}

export interface AgentSessionRuntimeOptions {
  agent: AgentId;
  autostart?: boolean;
  context?: AgentContextPort;
  environment?: () => AgentSessionEnvironment | null;
  id: string;
  /** Called after a write tool settles successfully or a native diff
   *  arrives, so the shell can refresh what the change touched. */
  onFilesChanged?: (change: AgentFilesChanged) => void;
  port: AgentSessionPort;
  scheduler?: AgentReconnectScheduler;
  scope: AgentScope;
  title?: string;
}

const NO_ENVIRONMENT: AgentSessionEnvironment = { listing: null, readiness: {} };

const refuseContext = () =>
  Promise.reject(
    new AgentContextError('unavailable', 'File context is unavailable in this session.'),
  );

function unavailableContextPort(): AgentContextPort {
  return { resolve: refuseContext, upload: refuseContext };
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

function latestUserBlock(
  state: AgentSessionState,
): Extract<AgentSessionState['transcript'][number], { kind: 'user' }> | undefined {
  for (let index = state.transcript.length - 1; index >= 0; index -= 1) {
    const block = state.transcript[index];
    if (block?.kind === 'user') return block;
  }
  return undefined;
}

export function createAgentSessionRuntime({
  agent,
  autostart = true,
  context: contextPort = unavailableContextPort(),
  environment = () => null,
  id,
  onFilesChanged,
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
  let pendingPrompt: PendingPrompt | null = null;
  let appliedAccessMode: AgentAccessMode | null = null;
  let sending = false;
  /** Wire text per sent user block, so a retry resends exactly what went out. */
  const wireByBlock = new Map<string, string>();
  /** Context snapshots of prompts the composer pulled out of the queue,
   *  kept until their dispatch names them. */
  const dequeued = new Map<string, DequeuedPrompt>();
  /** Uploaded Files by their temp path, so tiles can render what was sent. */
  const transientFiles = new Map<string, File>();

  const nextBlockId = (kind: string) => `${id}-${kind}-${++blockSequence}`;

  const transition = (action: Parameters<typeof transitionAgentSession>[1]) => {
    store.setState((state) => transitionAgentSession(state, action), true);
  };

  const notifyFilesChanged = (changed: string[]) => {
    if (changed.length === 0 || !onFilesChanged) return;
    const scope = store.getState().scope;
    const paths = [...new Set(changed)];
    onFilesChanged({
      paths,
      scope,
      sources: paths.flatMap((path) => changedSource(scope, path) ?? []),
    });
  };

  const stashDequeued = (promptId: string, prompt: DequeuedPrompt) => {
    dequeued.set(promptId, prompt);
    while (dequeued.size > MAX_DEQUEUED) {
      const oldest = dequeued.keys().next().value;
      if (oldest === undefined) break;
      dequeued.delete(oldest);
    }
  };

  /** Sends the wire prompt and records the user's own view of it. */
  const submit = (prompt: PendingPrompt): boolean => {
    const sent = connection?.send?.({ t: 'prompt', text: prompt.wire }) ?? false;
    if (sent) {
      const blockId = nextBlockId('user');
      wireByBlock.set(blockId, prompt.wire);
      transition({
        at: Date.now(),
        context: prompt.context,
        id: blockId,
        text: prompt.display,
        type: 'submit-prompt',
      });
    }
    return sent;
  };

  const resolveLines = async (
    context: AgentContextItem[],
  ): Promise<ResolvedContextLine[] | 'stale'> => {
    const results = await Promise.allSettled(
      context.map(async (item): Promise<ResolvedContextLine> => {
        if (item.kind !== 'source') return { item, resolved: null };
        return { item, resolved: await contextPort.resolve(item.source, controller.signal) };
      }),
    );
    const lines: ResolvedContextLine[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        lines.push(result.value);
        continue;
      }
      if (result.reason instanceof AgentContextError && result.reason.kind === 'not-found') {
        return 'stale';
      }
      lines.push({ item: context[index]!, resolved: null });
    }
    return lines;
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
                  if (!submit(prompt)) {
                    transition({ draft: prompt.display, type: 'set-draft' });
                    transition({ context: prompt.context, type: 'set-context' });
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
              case 'tool-finished': {
                const tool = store
                  .getState()
                  .transcript.find((block) => block.kind === 'tool' && block.id === event.id);
                const settles =
                  tool?.kind === 'tool' && tool.status !== 'denied' && tool.status !== 'cancelled';
                transition({
                  content: event.content,
                  id: event.id,
                  isError: event.isError,
                  type: 'finish-tool',
                });
                if (settles && !event.isError) {
                  notifyFilesChanged(
                    fileChangesForTool(tool.name, tool.input).map((change) => change.path),
                  );
                }
                break;
              }
              case 'file-changed':
                transition({
                  additions: event.additions,
                  after: event.after,
                  before: event.before,
                  deletions: event.deletions,
                  id: event.id,
                  path: event.path,
                  type: 'record-file-change',
                });
                notifyFilesChanged([event.path]);
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
                  const prompt = latestUserBlock(store.getState());
                  transition({
                    failure: event.failure,
                    id: nextBlockId('error'),
                    message: event.message,
                    retryablePrompt: prompt && (wireByBlock.get(prompt.id) ?? prompt.text),
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
    addContext(item) {
      if (disposed) return;
      transition({ context: addContextItem(store.getState().context, item), type: 'set-context' });
    },
    removeContext(key) {
      if (disposed) return;
      transition({
        context: removeContextItem(store.getState().context, key),
        type: 'set-context',
      });
    },
    fileForTransient(path) {
      return transientFiles.get(path);
    },
    async attachFiles(files) {
      if (disposed || files.length === 0) return;
      let outcomes;
      try {
        outcomes = await contextPort.upload(files, controller.signal);
      } catch (error) {
        if (disposed) return;
        transition({
          message:
            error instanceof AgentContextError
              ? error.message
              : 'The attachment could not be uploaded.',
          type: 'set-context-issue',
        });
        return;
      }
      if (disposed) return;
      let failed = 0;
      let context = store.getState().context;
      outcomes.forEach((outcome, index) => {
        if (!outcome.path) {
          failed += 1;
          return;
        }
        const file = files[index];
        if (file) transientFiles.set(outcome.path, file);
        context = addContextItem(context, {
          kind: 'transient',
          name: outcome.name,
          path: outcome.path,
        });
      });
      transition({ context, type: 'set-context' });
      if (failed > 0) {
        transition({
          message: `${failed} ${failed === 1 ? 'file' : 'files'} could not be attached.`,
          type: 'set-context-issue',
        });
      }
    },
    async sendPrompt(text = store.getState().draft, options = {}) {
      if (disposed || store.getState().activeTurn || sending) return { ok: false, reason: 'busy' };
      const state = store.getState();
      const prompt = text.trim();
      const queued = options.queuedId === undefined ? undefined : dequeued.get(options.queuedId);
      if (options.queuedId !== undefined) dequeued.delete(options.queuedId);
      const context = queued?.context ?? state.context;
      if (!prompt && context.length === 0) return { ok: false, reason: 'empty' };
      if (state.phase !== 'draft' && state.phase !== 'live') {
        return { ok: false, reason: 'disconnected' };
      }
      const stale = staleContext(
        validateContext(context, { ...(environment() ?? NO_ENVIRONMENT), scope: state.scope }),
      );
      if (stale.length > 0) {
        transition({
          message: stale[0]?.reason ?? 'This file is no longer available.',
          type: 'set-context-issue',
        });
        return { ok: false, reason: 'stale' };
      }
      sending = true;
      try {
        const lines = await resolveLines(context);
        if (disposed) return { ok: false, reason: 'disconnected' };
        if (lines === 'stale') {
          transition({
            message: 'That file is no longer in this folder.',
            type: 'set-context-issue',
          });
          return { ok: false, reason: 'stale' };
        }
        const wire = renderPromptContext(prompt, lines);
        const current = store.getState();
        if (current.activeTurn) return { ok: false, reason: 'busy' };
        if (current.phase === 'draft') {
          pendingPrompt = { context, display: prompt, wire };
          transition({ draft: prompt, type: 'set-draft' });
          runtime.start();
          return { ok: true };
        }
        if (current.phase !== 'live') return { ok: false, reason: 'disconnected' };
        return submit({ context, display: prompt, wire })
          ? { ok: true }
          : { ok: false, reason: 'disconnected' };
      } finally {
        sending = false;
      }
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
      if (disposed) return;
      const state = store.getState();
      const previous = new Map(state.queuedPrompts.map((prompt) => [prompt.id, prompt]));
      let draftTaken = false;
      const next: AgentQueuedPrompt[] = queue.map((entry) => {
        if (entry.context) return { context: entry.context, id: entry.id, text: entry.text };
        const known = previous.get(entry.id);
        if (known) return { ...known, text: entry.text };
        // The composer queues the draft: the first new entry carries the
        // draft's bound context with it.
        const context = draftTaken ? [] : state.context;
        draftTaken = true;
        return { context, id: entry.id, text: entry.text };
      });
      const nextIds = new Set(queue.map((entry) => entry.id));
      let restored: AgentContextItem[] | null = null;
      for (const [promptId, prompt] of previous) {
        if (nextIds.has(promptId)) continue;
        // Editing a queued message puts its text back in the composer before
        // the row leaves the queue; its context follows the text. Any other
        // exit (dispatch, removal) keeps the snapshot for a named dispatch.
        if (!draftTaken && state.context.length === 0 && state.draft === prompt.text) {
          restored = prompt.context;
        } else {
          stashDequeued(promptId, { context: prompt.context, text: prompt.text });
        }
      }
      transition({ queue: next, type: 'set-queue' });
      if (draftTaken && state.context.length > 0) transition({ context: [], type: 'set-context' });
      if (restored) transition({ context: restored, type: 'set-context' });
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
      dequeued.clear();
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
      dequeued.clear();
      transientFiles.clear();
      controller.abort();
      closeConnection();
      transition({ type: 'dispose' });
    },
  };

  if (autostart) runtime.start();
  return runtime;
}
