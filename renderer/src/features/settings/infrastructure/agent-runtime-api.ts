import { AgentRuntimeError, type AgentRuntimePort } from '@/features/settings/application/ports';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  agentRuntimeDebugPatchRequestSchema,
  agentRuntimeFailureSchema,
  agentsResponseSchema,
  hostedAgentAllowanceSchema,
  type AgentsResponseWire,
  type HostedAgentAllowanceWire,
} from '@/protocols/http/agent-runtime';

function mapAgentsResponse(response: HttpResponse): AgentsResponseWire {
  if (response.status >= 200 && response.status < 300) {
    const result = agentsResponseSchema.safeParse(response.body);
    if (result.success) return result.data;
    throw new AgentRuntimeError('invalid-response', 'Agent catalog returned an invalid response.');
  }
  const failure = agentRuntimeFailureSchema.safeParse(response.body);
  throw new AgentRuntimeError(
    'unavailable',
    'Agent runtimes are unavailable.',
    failure.success ? { cause: new Error(failure.data.error) } : undefined,
  );
}

function mapAllowanceResponse(response: HttpResponse): HostedAgentAllowanceWire {
  if (response.status >= 200 && response.status < 300) {
    const result = hostedAgentAllowanceSchema.safeParse(response.body);
    if (result.success) return result.data;
    throw new AgentRuntimeError(
      'invalid-response',
      'Agent allowance returned an invalid response.',
    );
  }
  const failure = agentRuntimeFailureSchema.safeParse(response.body);
  throw new AgentRuntimeError(
    'unavailable',
    'Agent runtimes are unavailable.',
    failure.success ? { cause: new Error(failure.data.error) } : undefined,
  );
}

export function createAgentRuntimeApi(client: HttpClient): AgentRuntimePort {
  return {
    async listAgents(signal) {
      try {
        return mapAgentsResponse(
          await client.request({ method: 'GET', path: '/api/terminal/clis', signal }),
        );
      } catch (error) {
        if (error instanceof AgentRuntimeError || signal.aborted) throw error;
        throw new AgentRuntimeError('unavailable', 'Agent runtimes are unavailable.', {
          cause: error,
        });
      }
    },
    async prepareAgent(id, action, signal) {
      try {
        return mapAgentsResponse(
          await client.request({
            method: 'POST',
            path: `/api/terminal/clis/${id}/${action}`,
            signal,
          }),
        );
      } catch (error) {
        if (error instanceof AgentRuntimeError || signal.aborted) throw error;
        throw new AgentRuntimeError('unavailable', 'Agent runtimes are unavailable.', {
          cause: error,
        });
      }
    },
    async updateDebug(patch, signal) {
      try {
        const body = agentRuntimeDebugPatchRequestSchema.parse(patch);
        return mapAgentsResponse(
          await client.request({ body, method: 'PUT', path: '/api/terminal/debug', signal }),
        );
      } catch (error) {
        if (error instanceof AgentRuntimeError || signal.aborted) throw error;
        throw new AgentRuntimeError('unavailable', 'Agent runtimes are unavailable.', {
          cause: error,
        });
      }
    },
    async resetManagedAgent(id, signal) {
      try {
        return mapAgentsResponse(
          await client.request({
            method: 'DELETE',
            path: `/api/terminal/clis/${id}/managed`,
            signal,
          }),
        );
      } catch (error) {
        if (error instanceof AgentRuntimeError || signal.aborted) throw error;
        throw new AgentRuntimeError('unavailable', 'Agent runtimes are unavailable.', {
          cause: error,
        });
      }
    },
    async getAllowance(signal) {
      try {
        return mapAllowanceResponse(
          await client.request({ method: 'GET', path: '/api/account/agent-usage', signal }),
        );
      } catch (error) {
        if (error instanceof AgentRuntimeError || signal.aborted) throw error;
        throw new AgentRuntimeError('unavailable', 'Agent runtimes are unavailable.', {
          cause: error,
        });
      }
    },
  };
}
