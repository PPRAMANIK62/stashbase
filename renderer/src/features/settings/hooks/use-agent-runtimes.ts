import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AgentRuntimePort } from '@/features/settings/application/ports';
import {
  agentAllowanceQuery,
  agentAllowanceQueryKeys,
  agentCatalogQuery,
  agentCatalogQueryKeys,
} from '@/features/settings/application/queries';
import type { AgentId } from '@/shared/agent-protocol';
import type { AgentRuntimeDebugState, AgentsResponse } from '@/shared/agent-runtime';

export function useAgentRuntimes(port: AgentRuntimePort) {
  const queryClient = useQueryClient();

  const catalog = useQuery({
    ...agentCatalogQuery(port),
    refetchInterval: (query) => {
      const active = query.state.data?.clis.some(
        (agent) =>
          agent.bootstrap?.phase === 'installing' ||
          agent.bootstrap?.phase === 'authenticating' ||
          agent.bootstrap?.phase === 'configuring',
      );
      return active ? 500 : false;
    },
  });

  const stashbaseReady =
    catalog.data?.clis.some(
      (agent) => agent.id === 'stashbase' && agent.bootstrap?.phase === 'ready',
    ) ?? false;

  // Appending the catalog's last-successful-fetch timestamp forces a
  // refetch whenever the catalog changes, in addition to `enabled` flipping
  // true the moment a stashbase agent turns ready.
  const allowance = useQuery({
    ...agentAllowanceQuery(port),
    queryKey: [...agentAllowanceQueryKeys.all, catalog.dataUpdatedAt] as const,
    enabled: stashbaseReady,
  });

  const applyResponse = (response: AgentsResponse) => {
    queryClient.setQueryData(agentCatalogQueryKeys.all, response);
  };

  const install = useMutation({
    mutationFn: (id: AgentId) => port.prepareAgent(id, 'bootstrap', new AbortController().signal),
    onSuccess: applyResponse,
  });
  const login = useMutation({
    mutationFn: (id: AgentId) => port.prepareAgent(id, 'login', new AbortController().signal),
    onSuccess: applyResponse,
  });
  const uninstall = useMutation({
    mutationFn: (id: AgentId) => port.resetManagedAgent(id, new AbortController().signal),
    onSuccess: applyResponse,
  });
  const updateDebug = useMutation({
    mutationFn: (patch: Partial<Omit<AgentRuntimeDebugState, 'enabled'>>) =>
      port.updateDebug(patch, new AbortController().signal),
    onSuccess: applyResponse,
  });
  const resetFirstRun = useMutation({
    mutationFn: async (id: AgentId) => {
      await port.updateDebug({ discoveryPolicy: 'managed-only' }, new AbortController().signal);
      return port.resetManagedAgent(id, new AbortController().signal);
    },
    onSuccess: applyResponse,
  });

  return { catalog, allowance, install, login, uninstall, updateDebug, resetFirstRun };
}
