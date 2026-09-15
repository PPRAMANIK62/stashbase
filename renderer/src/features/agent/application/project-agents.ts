import { createStore } from 'zustand/vanilla';

import type { AgentPreferencesPort } from '@/features/agent/application/ports';
import { DEFAULT_AGENT_ID } from '@/features/agent/domain/agent-catalog';
import { agentScopeKey, type AgentId, type AgentScope } from '@/features/agent/domain/session';

/** One cache of explicit project choices; failed reads never become saved defaults. */
export function createProjectAgents(port: AgentPreferencesPort | undefined, signal: AbortSignal) {
  const store = createStore(() => ({ loading: Boolean(port), failure: null as string | null }));
  const choices = new Map<string, AgentId>();
  let loading: Promise<boolean> | null = null;
  let saving = false;
  const load = (): Promise<boolean> => {
    if (!port) return Promise.resolve(true);
    if (loading) return loading;
    store.setState({ loading: true, failure: null });
    loading = port
      .load(signal)
      .then((entries) => {
        signal.throwIfAborted();
        choices.clear();
        for (const entry of entries) choices.set(entry.scope, entry.agent);
        return true;
      })
      .catch(() => {
        if (!signal.aborted)
          store.setState({ failure: 'Could not load your Agent choice. Retry before sending.' });
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
    get: (scope: AgentScope) => choices.get(agentScopeKey(scope)) ?? DEFAULT_AGENT_ID,
    async select(scope: AgentScope, agent: AgentId): Promise<boolean> {
      if (saving || signal.aborted || store.getState().loading || store.getState().failure)
        return false;
      saving = true;
      try {
        await port?.save(scope, agent, signal);
        signal.throwIfAborted();
        choices.set(agentScopeKey(scope), agent);
        return true;
      } catch {
        if (!signal.aborted)
          store.setState({ failure: 'Could not save your Agent choice. Your message was kept.' });
        return false;
      } finally {
        saving = false;
      }
    },
  };
}
