import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { AgentCatalogPort } from '@/features/agent/application/ports';
import { AGENT_ORDER } from '@/features/agent/domain/agent-catalog';
import type { AgentId } from '@/features/agent/domain/session';
import { useRequestSignals } from '@/lib/runtime/use-request-signals';

const AGENT_CATALOG_QUERY_KEY = ['agent', 'catalog'] as const;

export function useAgentCatalog(port: AgentCatalogPort) {
  const queryClient = useQueryClient();
  const signalFor = useRequestSignals<'prepare'>();
  const query = useQuery({
    queryKey: AGENT_CATALOG_QUERY_KEY,
    queryFn: ({ signal }) => port.listAgents(signal),
    retry: false,
    staleTime: 10_000,
  });
  const preparation = useMutation({
    mutationFn: ({ id, action }: { id: AgentId; action: 'bootstrap' | 'login' }) =>
      port.prepareAgent(id, action, signalFor('prepare')),
    onSuccess: (response) => queryClient.setQueryData(AGENT_CATALOG_QUERY_KEY, response),
  });

  const agents = useMemo(
    () =>
      AGENT_ORDER.map((id) => query.data?.agents.find((agent) => agent.id === id)).filter(
        (agent) => agent !== undefined,
      ),
    [query.data],
  );
  const readyAgents = useMemo(() => agents.filter((agent) => agent.ready), [agents]);

  return {
    agents,
    error: query.isError || preparation.isError,
    loading: query.isLoading,
    prepare: preparation.mutate,
    preparingAgentId: preparation.isPending ? preparation.variables?.id : undefined,
    readyAgents,
  };
}
