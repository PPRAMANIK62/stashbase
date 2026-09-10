/**
 * The runtime catalog a conversation reads, and the one place the service's
 * runtime vocabulary becomes this feature's.
 *
 * The Agents panel reads the same endpoint to answer a different question, so
 * the two features map it separately: this one only ever asks whether a runtime
 * can carry a turn, what stands in the way when it cannot, and what a turn on
 * it may use. Capabilities the service omits are resolved here, so no view
 * repeats a `?? true` of its own.
 */
import { AgentSessionError, type AgentCatalogPort } from '@/features/agent/application/ports';
import type { Agent, AgentAbilities, AgentCatalog } from '@/features/agent/domain/agent-catalog';
import { request, type TransportRequest } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  agentRuntimeFailureSchema,
  agentsResponseSchema,
  type AgentsResponseWire,
  type AgentWire,
} from '@/protocols/http/agent-runtime';

/** A runtime that advertises nothing runs plain prompts. `modes` is the one
 *  capability every runtime has unless it says otherwise. */
function toAbilities(wire: AgentWire['capabilities']): AgentAbilities {
  return {
    attachments: wire?.attachments === true,
    effort: wire?.effort === true,
    models: wire?.models === true,
    modes: wire?.modes !== false,
    skills: wire?.skills === true,
  };
}

function toAgent(wire: AgentWire): Agent {
  return {
    id: wire.id,
    abilities: toAbilities(wire.capabilities),
    label: wire.label,
    needsSignIn: wire.bootstrap?.failure?.code === 'authentication-required',
    ready: wire.bootstrap?.phase === 'ready' && wire.state !== 'failed',
  };
}

function toCatalog(wire: AgentsResponseWire): AgentCatalog {
  return { agents: wire.clis.map(toAgent) };
}

function catalogRequest(
  path: string,
  signal: AbortSignal,
  method: 'GET' | 'POST',
): TransportRequest {
  return {
    error: AgentSessionError,
    failureSchema: agentRuntimeFailureSchema,
    messages: {
      'invalid-response': 'The Agent service returned an unexpected response.',
      'scope-lost': 'Agent runtimes are unavailable.',
      unauthorized: 'Agent runtimes are unavailable.',
      unavailable: 'StashBase could not reach the Agent service.',
    },
    method,
    path,
    signal,
  };
}

async function catalog(
  client: HttpClient,
  path: string,
  signal: AbortSignal,
  method: 'GET' | 'POST',
): Promise<AgentCatalog> {
  return toCatalog(
    await request(client, {
      ...catalogRequest(path, signal, method),
      schema: agentsResponseSchema,
    }),
  );
}

export function createAgentCatalogAdapter(client: HttpClient): AgentCatalogPort {
  return {
    listAgents(signal) {
      return catalog(client, '/api/terminal/clis', signal, 'GET');
    },
    prepareAgent(id, action, signal) {
      return catalog(client, `/api/terminal/clis/${id}/${action}`, signal, 'POST');
    },
  };
}
