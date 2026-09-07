import type { AgentRuntimePort } from '@/features/settings/application/ports';

export const agentCatalogQueryKeys = {
  all: ['settings', 'agent-catalog'] as const,
};

export const agentAllowanceQueryKeys = {
  all: ['settings', 'agent-allowance'] as const,
};

export function agentCatalogQuery(port: AgentRuntimePort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.listAgents(signal),
    queryKey: agentCatalogQueryKeys.all,
    retry: false,
  } as const;
}

export function agentAllowanceQuery(port: AgentRuntimePort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.getAllowance(signal),
    queryKey: agentAllowanceQueryKeys.all,
    retry: false,
  } as const;
}
