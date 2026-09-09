import type {
  AgentRuntimePort,
  CapturePort,
  TranscriptionPort,
} from '@/features/settings/application/ports';

export const agentCatalogQueryKeys = {
  all: ['settings', 'agent-catalog'] as const,
};

export const agentAllowanceQueryKeys = {
  all: ['settings', 'agent-allowance'] as const,
};

export const transcriptionQueryKeys = {
  all: ['settings', 'transcription'] as const,
};

export const captureQueryKeys = {
  all: ['settings', 'capture'] as const,
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

export function transcriptionQuery(port: TranscriptionPort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.load(signal),
    queryKey: transcriptionQueryKeys.all,
    retry: false,
  } as const;
}

export function captureQuery(port: CapturePort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.load(signal),
    queryKey: captureQueryKeys.all,
    retry: false,
  } as const;
}
