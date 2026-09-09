import type {
  AgentRuntimePort,
  CapturePort,
  TranscriptionPort,
} from '@/features/settings/application/ports';

export const settingsQueryKeys = {
  agentAllowance: ['settings', 'agent-allowance'] as const,
  agentCatalog: ['settings', 'agent-catalog'] as const,
  capture: ['settings', 'capture'] as const,
  transcription: ['settings', 'transcription'] as const,
};

export function agentCatalogQuery(port: AgentRuntimePort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.listAgents(signal),
    queryKey: settingsQueryKeys.agentCatalog,
    retry: false,
  } as const;
}

export function agentAllowanceQuery(port: AgentRuntimePort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.getAllowance(signal),
    queryKey: settingsQueryKeys.agentAllowance,
    retry: false,
  } as const;
}

export function transcriptionQuery(port: TranscriptionPort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.load(signal),
    queryKey: settingsQueryKeys.transcription,
    retry: false,
  } as const;
}

export function captureQuery(port: CapturePort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.load(signal),
    queryKey: settingsQueryKeys.capture,
    retry: false,
  } as const;
}
