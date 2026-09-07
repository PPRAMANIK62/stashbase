import type { HostedAgentAllowance } from '@/shared/account';
import type { AgentId } from '@/shared/agent-protocol';
import type { AgentRuntimeDebugState, AgentsResponse } from '@/shared/agent-runtime';

export interface AgentRuntimePort {
  listAgents(signal: AbortSignal): Promise<AgentsResponse>;
  prepareAgent(
    id: AgentId,
    action: 'check' | 'bootstrap' | 'login',
    signal: AbortSignal,
  ): Promise<AgentsResponse>;
  updateDebug(
    patch: Partial<Omit<AgentRuntimeDebugState, 'enabled'>>,
    signal: AbortSignal,
  ): Promise<AgentsResponse>;
  resetManagedAgent(id: AgentId, signal: AbortSignal): Promise<AgentsResponse>;
  getAllowance(signal: AbortSignal): Promise<HostedAgentAllowance>;
}

export type AgentRuntimeFailureKind = 'invalid-response' | 'unavailable';

export class AgentRuntimeError extends Error {
  readonly kind: AgentRuntimeFailureKind;

  constructor(kind: AgentRuntimeFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentRuntimeError';
    this.kind = kind;
  }
}
