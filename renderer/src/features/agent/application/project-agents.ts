import { createStore } from 'zustand/vanilla';

import type {
  AgentPreferencesPort,
  ProjectAgentPreference,
} from '@/features/agent/application/ports';
import { DEFAULT_AGENT_ID } from '@/features/agent/domain/agent-catalog';
import { supportedEffort } from '@/features/agent/domain/model-choice';
import {
  agentScopeKey,
  agentSessionIsUnstarted,
  type AgentId,
  type AgentScope,
} from '@/features/agent/domain/session';

import type { AgentSessionRuntime } from './session-runtime';

/** One cache of explicit project choices; failed reads never become saved defaults. */
export function createProjectAgents(port: AgentPreferencesPort | undefined, signal: AbortSignal) {
  const store = createStore(() => ({ loading: Boolean(port), failure: null as string | null }));
  const choices = new Map<string, ProjectAgentPreference>();
  let loading: Promise<boolean> | null = null;
  let saving = false;
  let pendingSave = Promise.resolve(true);
  const seedEffort = (session: AgentSessionRuntime) => {
    const state = session.store.getState();
    const effort = choices.get(agentScopeKey(state.scope))?.efforts?.[state.agent] ?? null;
    session.store.setState({ effort: supportedEffort(state, effort) });
  };
  const save = (scope: AgentScope, agent: AgentId, effort?: string | null) => {
    pendingSave = pendingSave.then(async () => {
      if (signal.aborted) return false;
      try {
        await port?.save(scope, agent, signal, effort);
        signal.throwIfAborted();
        return true;
      } catch {
        if (!signal.aborted)
          store.setState({ failure: 'Could not save your Agent settings. Your message was kept.' });
        return false;
      }
    });
    return pendingSave;
  };
  const load = (): Promise<boolean> => {
    if (!port) return Promise.resolve(true);
    if (loading) return loading;
    store.setState({ loading: true, failure: null });
    loading = pendingSave
      .then(() => port.load(signal))
      .then((entries) => {
        signal.throwIfAborted();
        choices.clear();
        for (const entry of entries) choices.set(entry.scope, entry);
        return true;
      })
      .catch(() => {
        if (!signal.aborted)
          store.setState({ failure: 'Could not load your Agent settings. Retry before sending.' });
        return false;
      })
      .finally(() => {
        loading = null;
        store.setState({ loading: false });
      });
    return loading;
  };
  return {
    store,
    load,
    seedEffort,
    apply(session: AgentSessionRuntime) {
      const state = session.store.getState();
      if (!agentSessionIsUnstarted(state)) return;
      const agent = choices.get(agentScopeKey(state.scope))?.agent ?? DEFAULT_AGENT_ID;
      if (state.agent !== agent) session.changeAgent(agent);
      seedEffort(session);
    },
    get: (scope: AgentScope) => choices.get(agentScopeKey(scope))?.agent ?? DEFAULT_AGENT_ID,
    rememberEffort(scope: AgentScope, agent: AgentId, effort: string | null) {
      if (signal.aborted || store.getState().loading || store.getState().failure) return;
      const key = agentScopeKey(scope);
      const previous = choices.get(key);
      choices.set(key, {
        scope: key,
        agent: previous?.agent ?? agent,
        efforts: { ...previous?.efforts, [agent]: effort },
      });
      void save(scope, agent, effort);
    },
    async select(scope: AgentScope, agent: AgentId): Promise<boolean> {
      if (saving || signal.aborted || store.getState().loading || store.getState().failure)
        return false;
      saving = true;
      try {
        if (!(await save(scope, agent))) return false;
        const key = agentScopeKey(scope);
        choices.set(key, { ...choices.get(key), scope: key, agent });
        return true;
      } finally {
        saving = false;
      }
    },
  };
}
