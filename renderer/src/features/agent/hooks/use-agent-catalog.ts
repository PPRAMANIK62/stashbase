import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { AgentCatalogPort } from '@/features/agent/application/ports';
import { AGENT_ORDER } from '@/features/agent/domain/agent-catalog';

const AGENT_CATALOG_QUERY_KEY = ['agent', 'catalog'] as const;

export function useAgentCatalog(port: AgentCatalogPort) {
  const query = useQuery({
    queryKey: AGENT_CATALOG_QUERY_KEY,
    queryFn: ({ signal }) => port.listAgents(signal),
    retry: false,
    staleTime: 10_000,
  });
  const agents = useMemo(
    () =>
      AGENT_ORDER.map((id) => query.data?.agents.find((agent) => agent.id === id)).filter(
        (agent) => agent !== undefined,
      ),
    [query.data],
  );
  const readyAgents = useMemo(() => agents.filter((agent) => agent.ready), [agents]);

  const { refetch } = query;
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    agents,
    error: query.isError,
    loading: query.isLoading,
    readyAgents,
    refresh,
  };
}
