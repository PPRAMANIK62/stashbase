/**
 * The standing instructions a scope's Chats run under.
 *
 * The scope reaches the wire through one helper, so the `?scope=` parameter a
 * read sends and the identity a re-read keys on cannot disagree. Deriving them
 * separately is how an editor shows one scope's text and saves it into
 * another's.
 *
 * The resolved prompt is never spoken here. The server composes what a turn
 * actually carries; this is only the reader's own layer over a packaged
 * default.
 */
import {
  AgentSessionError,
  type AgentInstructions,
  type AgentInstructionsPort,
} from '@/features/agent/application/ports';
import { agentScopeKey } from '@/features/agent/domain/session';
import { request, type TransportRequest } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  agentInstructionsRequestSchema,
  agentInstructionsStateSchema,
  type AgentInstructionsStateWire,
} from '@/protocols/http/agent-instructions';
import { agentRuntimeFailureSchema } from '@/protocols/http/agent-runtime';

function toInstructions(wire: AgentInstructionsStateWire): AgentInstructions {
  return { customized: wire.customized, text: wire.text };
}

function instructionsRequest(
  path: string,
  signal: AbortSignal,
  method: 'GET' | 'PUT',
): TransportRequest {
  return {
    error: AgentSessionError,
    failureSchema: agentRuntimeFailureSchema,
    messages: {
      'invalid-response': 'Agent Instructions returned an unexpected response.',
      'scope-lost': 'That folder is no longer available in this window.',
      unauthorized: 'Agent Instructions are unavailable.',
      unavailable: 'StashBase could not reach the Agent service.',
    },
    method,
    path,
    signal,
  };
}

export function createAgentInstructionsAdapter(client: HttpClient): AgentInstructionsPort {
  return {
    async load(scope, signal) {
      const value = agentScopeKey(scope);
      return toInstructions(
        await request(client, {
          ...instructionsRequest(
            `/api/agent-instructions?scope=${encodeURIComponent(value)}`,
            signal,
            'GET',
          ),
          schema: agentInstructionsStateSchema,
        }),
      );
    },
    async save(scope, text, signal) {
      return toInstructions(
        await request(client, {
          ...instructionsRequest('/api/agent-instructions', signal, 'PUT'),
          body: agentInstructionsRequestSchema.parse({
            scope: agentScopeKey(scope),
            text,
          }),
          schema: agentInstructionsStateSchema,
        }),
      );
    },
  };
}
