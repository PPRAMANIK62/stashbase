import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { AGENT_ORDER, isReadyAgent } from '@/features/agent/application/catalog';
import type { AgentCatalogPort } from '@/features/agent/application/ports';
import type { AgentId } from '@/features/agent/domain/session';

export const AGENT_CATALOG_QUERY_KEY = ['agent', 'catalog'] as const;

export function useAgentCatalog(port: AgentCatalogPort) {
  const queryClient = useQueryClient();
  const preparationController = useRef<AbortController | null>(null);
  const query = useQuery({
    queryKey: AGENT_CATALOG_QUERY_KEY,
    queryFn: ({ signal }) => port.listAgents(signal),
    retry: false,
    staleTime: 10_000,
  });
  const preparation = useMutation({
    mutationFn: ({ id, action }: { id: AgentId; action: 'bootstrap' | 'login' }) => {
      preparationController.current?.abort();
      const controller = new AbortController();
      preparationController.current = controller;
      return port.prepareAgent(id, action, controller.signal);
    },
    onSuccess: (response) => queryClient.setQueryData(AGENT_CATALOG_QUERY_KEY, response),
  });

  useEffect(() => () => preparationController.current?.abort(), []);

  const agents = useMemo(
    () =>
      AGENT_ORDER.map((id) => query.data?.clis.find((agent) => agent.id === id)).filter(
        (agent) => agent !== undefined,
      ),
    [query.data],
  );
  const readyAgents = useMemo(() => agents.filter(isReadyAgent), [agents]);

  return {
    agents,
    error: query.isError || preparation.isError,
    loading: query.isLoading,
    prepare: preparation.mutate,
    preparingAgentId: preparation.isPending ? preparation.variables?.id : undefined,
    readyAgents,
  };
}
