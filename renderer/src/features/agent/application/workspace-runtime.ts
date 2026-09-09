import { createStore, type StoreApi } from 'zustand/vanilla';

import type {
  AgentContextPort,
  AgentReconnectScheduler,
  AgentSessionPort,
} from '@/features/agent/application/ports';
import {
  createAgentSessionRuntime,
  type AgentFilesChanged,
  type AgentSessionRuntime,
} from '@/features/agent/application/session-runtime';
import type { AgentScopeEnvironment } from '@/features/agent/domain/context';
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import {
  agentScopesEqual,
  scopeForWindowFolder,
  type AgentId,
  type AgentScope,
} from '@/features/agent/domain/session';
import {
  activateAgentTab,
  createAgentWorkspaceState,
  disposeAgentWorkspace,
  removeAgentTab,
  upsertAgentTab,
  type AgentTabState,
  type AgentWorkspaceState,
} from '@/features/agent/domain/workspace';

export interface AgentWorkspaceRuntime {
  readonly signal: AbortSignal;
  readonly store: StoreApi<AgentWorkspaceState>;
  activate(id: string): void;
  activeSession(): AgentSessionRuntime;
  close(id: string): void;
  dispose(): void;
  listHistory(agent: AgentId, scope: AgentScope, signal: AbortSignal): Promise<AgentHistoryEntry[]>;
  newChat(agent?: AgentId, scope?: AgentScope): AgentSessionRuntime;
  removeHistory(entry: AgentHistoryEntry, signal: AbortSignal): Promise<void>;
  renameHistory(
    entry: AgentHistoryEntry,
    title: string,
    signal: AbortSignal,
  ): Promise<AgentHistoryEntry>;
  restore(entry: AgentHistoryEntry): Promise<boolean>;
  retireFolder(folderPath: string): void;
  session(id: string): AgentSessionRuntime | null;
  start(availableAgents?: readonly AgentId[]): void;
  startActive(): void;
  /** Publishes the window folder's listing and preparation state so sessions
   *  bound to that folder validate context against it. */
  setScopeEnvironment(environment: AgentScopeEnvironment | null): void;
  setWindowFolder(folderPath: string | null): void;
}

export interface AgentWorkspaceRuntimeOptions {
  autostart?: boolean;
  context?: AgentContextPort;
  createId(): string;
  folderPath: string | null;
  initialAgent?: AgentId;
  /** Files any session's settled write left changed. */
  onFilesChanged?: (change: AgentFilesChanged) => void;
  port: AgentSessionPort;
  scheduler?: AgentReconnectScheduler;
}

interface MountedAgentSession {
  followsWindow: boolean;
  runtime: AgentSessionRuntime;
  unsubscribe(): void;
}

export function createAgentWorkspaceRuntime({
  autostart = true,
  context,
  createId,
  folderPath: initialFolderPath,
  initialAgent = 'stashbase',
  onFilesChanged,
  port,
  scheduler,
}: AgentWorkspaceRuntimeOptions): AgentWorkspaceRuntime {
  const sessions = new Map<string, MountedAgentSession>();
  const controller = new AbortController();
  let folderPath = initialFolderPath;
  let disposed = false;
  let started = autostart;
  let readyAgentIds = new Set<AgentId>();

  const initialId = createId();
  if (!initialId.trim()) throw new Error('Agent tab ids must not be empty.');
  const store = createStore<AgentWorkspaceState>(() => createAgentWorkspaceState(initialId));

  const operationSignal = (signal: AbortSignal) => AbortSignal.any([controller.signal, signal]);

  const syncTab = (id: string) => {
    const mounted = sessions.get(id);
    if (!mounted) return;
    const state = mounted.runtime.store.getState();
    const workspace = store.getState();
    const previous = workspace.tabs.find((tab) => tab.id === id);
    const transcriptModified = Math.max(
      0,
      ...state.transcript.flatMap((block) =>
        'at' in block && block.at !== undefined ? [block.at] : [],
      ),
    );
    const hasContent = state.transcript.length > 0;
    // Recency follows the user's own prompts and the native record. Opening
    // or replaying a chat must not promote it in the history list.
    const lastModified = Math.max(
      state.lastModified,
      transcriptModified,
      previous?.lastModified ?? 0,
    );
    store.setState(
      upsertAgentTab(workspace, {
        agent: state.agent,
        blank: mounted.runtime.isBlank(),
        hasContent,
        id,
        lastModified,
        nativeSessionId: state.nativeSessionId,
        phase: state.phase,
        scope: state.scope,
        title: state.title,
      }),
      true,
    );
  };

  const mountSession = (
    id: string,
    agent: AgentId,
    scope: AgentScope,
    title = 'New chat',
  ): AgentSessionRuntime => {
    const previous = sessions.get(id);
    previous?.unsubscribe();
    previous?.runtime.dispose();
    const session = createAgentSessionRuntime({
      agent,
      autostart: false,
      context,
      environment: () => {
        const environment = store.getState().scopeEnvironment;
        const sessionScope = sessions.get(id)?.runtime.store.getState().scope ?? scope;
        return environment &&
          sessionScope.kind === 'folder' &&
          environment.folderPath === sessionScope.path
          ? { listing: environment.listing, readiness: environment.readiness }
          : null;
      },
      id,
      onFilesChanged,
      port,
      scheduler,
      scope,
      title,
    });
    const sessionState = session.store.getState();
    const tab: AgentTabState = {
      agent: sessionState.agent,
      blank: session.isBlank(),
      hasContent: false,
      id,
      lastModified: 0,
      nativeSessionId: sessionState.nativeSessionId,
      phase: sessionState.phase,
      scope: sessionState.scope,
      title: sessionState.title,
    };
    store.setState((workspace) => upsertAgentTab(workspace, tab), true);
    const followsWindow = previous?.followsWindow ?? false;
    sessions.set(id, {
      followsWindow,
      runtime: session,
      unsubscribe: session.store.subscribe(() => syncTab(id)),
    });
    return session;
  };

  mountSession(initialId, initialAgent, scopeForWindowFolder(folderPath));
  sessions.get(initialId)!.followsWindow = true;

  const runtime: AgentWorkspaceRuntime = {
    signal: controller.signal,
    store,
    activate(id) {
      if (!disposed && sessions.has(id)) {
        store.setState((state) => activateAgentTab(state, id), true);
      }
    },
    activeSession() {
      const mounted = sessions.get(store.getState().activeId);
      if (!mounted) throw new Error('Agent workspace has no active session.');
      return mounted.runtime;
    },
    close(id) {
      if (disposed || !sessions.has(id)) return;
      if (sessions.size === 1) {
        sessions.get(id)!.followsWindow = true;
        mountSession(id, initialAgent, scopeForWindowFolder(folderPath));
        return;
      }
      const wasActive = store.getState().activeId === id;
      const mounted = sessions.get(id);
      mounted?.unsubscribe();
      mounted?.runtime.dispose();
      sessions.delete(id);
      const visibleScope = scopeForWindowFolder(folderPath);
      const nextWorkspace = removeAgentTab(store.getState(), id, visibleScope);
      store.setState(nextWorkspace, true);
      if (wasActive && !nextWorkspace.activeId) {
        mountSession(id, initialAgent, visibleScope);
        sessions.get(id)!.followsWindow = true;
        store.setState((state) => activateAgentTab(state, id), true);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      for (const mounted of sessions.values()) {
        mounted.unsubscribe();
        mounted.runtime.dispose();
      }
      sessions.clear();
      store.setState((state) => disposeAgentWorkspace(state), true);
    },
    listHistory(agent, scope, signal) {
      return port.list(agent, scope, operationSignal(signal));
    },
    newChat(agent = 'stashbase', scope?: AgentScope) {
      if (disposed) throw new Error('Agent workspace is disposed.');
      const followsCurrentFolder = scope === undefined;
      const nextScope = scope ?? scopeForWindowFolder(folderPath);
      const blank = [...sessions.values()].find(({ runtime: session }) => session.isBlank());
      const id = blank?.runtime.id ?? createId();
      if (!id.trim() || (!blank && sessions.has(id))) {
        throw new Error('Agent tab ids must be non-empty and unique.');
      }
      const existing = blank?.runtime.store.getState();
      const session =
        blank && existing?.agent === agent && agentScopesEqual(existing.scope, nextScope)
          ? blank.runtime
          : mountSession(id, agent, nextScope);
      sessions.get(id)!.followsWindow = followsCurrentFolder;
      store.setState((state) => activateAgentTab(state, id), true);
      return session;
    },
    async removeHistory(entry, signal) {
      await port.remove(entry, operationSignal(signal));
      for (const [id, mounted] of sessions) {
        const state = mounted.runtime.store.getState();
        if (
          state.agent === entry.agent &&
          state.nativeSessionId === entry.id &&
          agentScopesEqual(state.scope, entry.scope)
        ) {
          runtime.close(id);
        }
      }
    },
    async renameHistory(entry, title, signal) {
      const updated = await port.rename(entry, title, operationSignal(signal));
      for (const mounted of sessions.values()) {
        const state = mounted.runtime.store.getState();
        if (
          state.agent === entry.agent &&
          state.nativeSessionId === entry.id &&
          agentScopesEqual(state.scope, entry.scope)
        ) {
          mounted.runtime.rename(updated.title);
        }
      }
      return updated;
    },
    async restore(entry) {
      const session = runtime.newChat(entry.agent, entry.scope);
      sessions.get(session.id)!.followsWindow = false;
      return session.restore(entry, readyAgentIds.has(entry.agent));
    },
    retireFolder(retiredFolderPath) {
      if (disposed) return;
      for (const [id, mounted] of sessions) {
        const session = mounted.runtime;
        const state = session.store.getState();
        if (state.scope.kind !== 'folder' || state.scope.path !== retiredFolderPath) continue;
        if (session.isBlank()) {
          mountSession(id, state.agent, { kind: 'library' });
          sessions.get(id)!.followsWindow = true;
        } else {
          session.retire(retiredFolderPath);
        }
      }
    },
    session(id) {
      return sessions.get(id)?.runtime ?? null;
    },
    start(availableAgents) {
      if (disposed) return;
      if (availableAgents) readyAgentIds = new Set(availableAgents);
      if (!started) {
        const active = runtime.activeSession();
        const state = active.store.getState();
        const firstAvailable = [...readyAgentIds][0];
        if (active.isBlank() && firstAvailable && !readyAgentIds.has(state.agent)) {
          mountSession(active.id, firstAvailable, state.scope);
        }
        started = true;
      }
      for (const { runtime: session } of sessions.values()) {
        if (!session.isBlank() && readyAgentIds.has(session.store.getState().agent))
          session.start();
      }
    },
    startActive() {
      if (disposed || !started) return;
      runtime.activeSession().start();
    },
    setScopeEnvironment(environment) {
      if (disposed || store.getState().scopeEnvironment === environment) return;
      store.setState((state) => ({ ...state, scopeEnvironment: environment }), true);
    },
    setWindowFolder(nextFolderPath) {
      if (disposed || nextFolderPath === folderPath) return;
      folderPath = nextFolderPath;
      for (const [id, mounted] of sessions) {
        if (!mounted.followsWindow) continue;
        const session = mounted.runtime;
        if (!session.isBlank()) {
          mounted.followsWindow = false;
          continue;
        }
        mountSession(id, session.store.getState().agent, scopeForWindowFolder(folderPath));
      }
      const nextScope = scopeForWindowFolder(folderPath);
      const current = runtime.activeSession().store.getState();
      const scopedTabs = store
        .getState()
        .tabs.filter((tab) => agentScopesEqual(tab.scope, nextScope));
      let retained: AgentTabState | undefined;
      for (let index = scopedTabs.length - 1; index >= 0; index -= 1) {
        if (!scopedTabs[index]?.blank) {
          retained = scopedTabs[index];
          break;
        }
      }
      if (retained) {
        store.setState((state) => activateAgentTab(state, retained.id), true);
        return;
      }
      if (agentScopesEqual(current.scope, nextScope)) return;
      const matching = scopedTabs.at(-1);
      if (matching) {
        store.setState((state) => activateAgentTab(state, matching.id), true);
        return;
      }
      runtime.newChat(initialAgent);
    },
  };

  return runtime;
}
