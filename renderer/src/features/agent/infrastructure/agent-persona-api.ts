/**
 * The persona a scope's Chats run under.
 *
 * The scope reaches the wire through one helper, so the `?scope=` parameter a
 * read sends and the identity a re-read keys on cannot disagree. Deriving them
 * separately is how a picker shows one scope's persona and saves it into
 * another's.
 *
 * The resolved prompt is never spoken here. The server composes what a
 * session actually carries; this is only which persona is chosen and the
 * reader's own prompt.
 */
import {
  AgentSessionError,
  type AgentPersona,
  type AgentPersonaPort,
} from '@/features/agent/application/ports';
import { agentScopeKey } from '@/features/agent/domain/session';
import { request, type TransportRequest } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  agentPersonaRequestSchema,
  agentPersonaStateSchema,
  type AgentPersonaStateWire,
} from '@/protocols/http/agent-persona';
import { agentRuntimeFailureSchema } from '@/protocols/http/agent-runtime';

function toPersona(wire: AgentPersonaStateWire): AgentPersona {
  return { custom: wire.custom, selected: wire.selected };
}

function personaRequest(
  path: string,
  signal: AbortSignal,
  method: 'GET' | 'PUT',
): TransportRequest {
  return {
    error: AgentSessionError,
    failureSchema: agentRuntimeFailureSchema,
    messages: {
      'invalid-response': 'The persona service returned an unexpected response.',
      'scope-lost': 'That folder is no longer available in this window.',
      unauthorized: 'Personas are unavailable.',
      unavailable: 'StashBase could not reach the Agent service.',
    },
    method,
    path,
    signal,
  };
}

export function createAgentPersonaAdapter(client: HttpClient): AgentPersonaPort {
  return {
    async load(scope, signal) {
      const value = agentScopeKey(scope);
      return toPersona(
        await request(client, {
          ...personaRequest(`/api/agent-persona?scope=${encodeURIComponent(value)}`, signal, 'GET'),
          schema: agentPersonaStateSchema,
        }),
      );
    },
    async save(scope, change, signal) {
      return toPersona(
        await request(client, {
          ...personaRequest('/api/agent-persona', signal, 'PUT'),
          body: agentPersonaRequestSchema.parse({ ...change, scope: agentScopeKey(scope) }),
          schema: agentPersonaStateSchema,
        }),
      );
    },
  };
}
