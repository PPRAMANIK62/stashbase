/** The Agent workspace for one renderer window: the tabs it shows, which
 *  session each tab is bound to, and how those bindings follow the window's
 *  folder. Sessions are mounted and retired here; the per-conversation
 *  behaviour lives in the session runtime this module composes. */
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
import {
  AGENT_RUNTIMES,
  DEFAULT_AGENT_ID,
  preferredAgent,
} from '@/features/agent/domain/agent-catalog';
import type { AgentScopeEnvironment } from '@/features/agent/domain/context';
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import {
  agentScopesEqual,
  agentSessionPhase,
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
import { createScopeGuard } from '@/lib/runtime/scope-guard';

/** What the workspace's operations are about: the window folder its sessions
 *  were bound to when the work started. */
type AgentWorkspaceScope = { readonly folderPath: string | null };

export interface AgentWorkspaceRuntime {
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
  autostart?: boolean | undefined;
  context?: AgentContextPort | undefined;
  createId(): string;
  folderPath: string | null;
  initialAgent?: AgentId | undefined;
  /** Files any session's settled write left changed. */
  onFilesChanged?: ((change: AgentFilesChanged) => void) | undefined;
  port: AgentSessionPort;
  scheduler?: AgentReconnectScheduler | undefined;
}

interface MountedAgentSession {
  followsWindow: boolean;
  runtime: AgentSessionRuntime;
  unsubscribe(): void;
}

/** Whether a mounted session is the one a history entry names. */
function boundTo({ runtime }: MountedAgentSession, entry: AgentHistoryEntry): boolean {
  const { agent, nativeSessionId, scope } = runtime.store.getState();
  return (
    agent === entry.agent && nativeSessionId === entry.id && agentScopesEqual(scope, entry.scope)
  );
}

export function createAgentWorkspaceRuntime({
  autostart = true,
  context,
  createId,
  folderPath: initialFolderPath,
  initialAgent = DEFAULT_AGENT_ID,
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

  /** The runtime owns one controller, aborted on dispose; a caller's own lane
   *  signal is joined to it so either can cancel the work. */
  const operationSignal = (signal: AbortSignal) => AbortSignal.any([controller.signal, signal]);

  const guard = createScopeGuard<AgentWorkspaceScope>({
    disposed: () => disposed,
    sameScope: (captured, live) => captured.folderPath === live.folderPath,
    scope: () => ({ folderPath }),
  });

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
        phase: agentSessionPhase(state.connection),
        scope: state.scope,
        title: state.title,
      }),
      true,
    );
  };

  /** Mounts a session under `id`, replacing any previous mount. A session
   *  that follows the window's folder is rebound when the folder changes;
   *  one opened for a fixed scope is not. */
  const mountSession = (
    id: string,
    agent: AgentId,
    scope: AgentScope,
    followsWindow: boolean,
    title = 'New chat',
  ): MountedAgentSession => {
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
      phase: agentSessionPhase(sessionState.connection),
      scope: sessionState.scope,
      title: sessionState.title,
    };
    store.setState((workspace) => upsertAgentTab(workspace, tab), true);
    const mounted: MountedAgentSession = {
      followsWindow,
      runtime: session,
      unsubscribe: session.store.subscribe(() => syncTab(id)),
    };
    sessions.set(id, mounted);
    return mounted;
  };

  mountSession(initialId, initialAgent, scopeForWindowFolder(folderPath), true);

  const runtime: AgentWorkspaceRuntime = {
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
        mountSession(id, initialAgent, scopeForWindowFolder(folderPath), true);
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
        mountSession(id, initialAgent, visibleScope, true);
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
    newChat(agent = DEFAULT_AGENT_ID, scope?: AgentScope) {
      if (disposed) throw new Error('Agent workspace is disposed.');
      const followsCurrentFolder = scope === undefined;
      const nextScope = scope ?? scopeForWindowFolder(folderPath);
      const blank = [...sessions.values()].find(({ runtime: session }) => session.isBlank());
      const id = blank?.runtime.id ?? createId();
      if (!id.trim() || (!blank && sessions.has(id))) {
        throw new Error('Agent tab ids must be non-empty and unique.');
      }
      const existing = blank?.runtime.store.getState();
      const mounted =
        blank && existing?.agent === agent && agentScopesEqual(existing.scope, nextScope)
          ? blank
          : mountSession(id, agent, nextScope, followsCurrentFolder);
      mounted.followsWindow = followsCurrentFolder;
      store.setState((state) => activateAgentTab(state, id), true);
      return mounted.runtime;
    },
    async removeHistory(entry, signal) {
      const captured = guard.capture();
      await port.remove(entry, operationSignal(signal));
      // Re-read the mounted set, and only while it is still the one the
      // removal started against: a retired folder remounted it.
      guard.accept(captured, () => {
        for (const [id, mounted] of sessions) {
          if (boundTo(mounted, entry)) runtime.close(id);
        }
      });
    },
    async renameHistory(entry, title, signal) {
      const captured = guard.capture();
      const updated = await port.rename(entry, title, operationSignal(signal));
      guard.accept(captured, () => {
        for (const mounted of sessions.values()) {
          if (boundTo(mounted, entry)) mounted.runtime.rename(updated.title);
        }
      });
      return updated;
    },
    async restore(entry) {
      // A restored chat names its own scope, so newChat leaves it pinned.
      const session = runtime.newChat(entry.agent, entry.scope);
      return session.restore(entry, readyAgentIds.has(entry.agent));
    },
    retireFolder(retiredFolderPath) {
      if (disposed) return;
      guard.retireOperations();
      for (const [id, mounted] of sessions) {
        const session = mounted.runtime;
        const state = session.store.getState();
        if (state.scope.kind !== 'folder' || state.scope.path !== retiredFolderPath) continue;
        if (session.isBlank()) {
          mountSession(id, state.agent, { kind: 'library' }, true);
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
        const firstAvailable = preferredAgent(
          AGENT_RUNTIMES.filter((entry) => readyAgentIds.has(entry.id)),
        )?.id;
        if (active.isBlank() && firstAvailable && !readyAgentIds.has(state.agent)) {
          mountSession(
            active.id,
            firstAvailable,
            state.scope,
            sessions.get(active.id)?.followsWindow ?? false,
          );
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
        mountSession(id, session.store.getState().agent, scopeForWindowFolder(folderPath), true);
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
