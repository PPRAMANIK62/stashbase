import { SettingsError, type McpAccessPort } from '@/features/settings/application/ports';
import { formatMcpConfig, type McpHttpAccess } from '@/features/settings/domain/mcp-access';
import {
  request,
  requestOptions,
  type TransportFailure,
  type TransportRequest,
} from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  mcpDockerAccessRequestSchema,
  mcpDockerPortRequestSchema,
  mcpFailureSchema,
  mcpHttpWriteResponseSchema,
  mcpStatusSchema,
  type McpHttpStatusWire,
} from '@/protocols/http/mcp';

/** The transport omits `dockerError` and `settingsError` when nothing is
 *  wrong; `domain/mcp-access.ts` spells "nothing is wrong" as null, so every
 *  reader above can compare instead of testing for presence. */
function toHttpAccess(wire: McpHttpStatusWire): McpHttpAccess {
  return {
    dockerAccess: wire.dockerAccess,
    dockerActive: wire.dockerActive,
    dockerError: wire.dockerError ?? null,
    dockerPort: wire.dockerPort,
    dockerUrl: wire.dockerUrl,
    loopbackUrl: wire.loopbackUrl,
    settingsError: wire.settingsError ?? null,
    token: wire.token,
  };
}

/** A refused write is the user's own request coming back, not a lost
 *  capability, so it reads as an invalid request. */
function invalidRequest(fallback: string) {
  return ({ response, serverMessage }: TransportFailure): SettingsError | null =>
    response.status === 400
      ? new SettingsError('invalid-request', serverMessage ?? fallback)
      : null;
}

function mcpAccess(
  path: string,
  signal: AbortSignal,
  messages: { invalid: string; unavailable: string },
): TransportRequest<'invalid-request'> {
  return requestOptions({
    error: SettingsError,
    failure: invalidRequest(messages.unavailable),
    failureSchema: mcpFailureSchema,
    messages: { 'invalid-response': messages.invalid, unavailable: messages.unavailable },
    path,
    serverMessage: true,
    signal,
  });
}

export function createMcpAccessAdapter(client: HttpClient): McpAccessPort {
  return {
    async status(signal) {
      const wire = await request(client, {
        ...mcpAccess('/api/mcp/status', signal, {
          invalid: 'MCP access settings returned an invalid response.',
          unavailable: 'MCP access settings are unavailable.',
        }),
        schema: mcpStatusSchema,
      });
      return {
        command: wire.command,
        config: formatMcpConfig(wire.config),
        http: toHttpAccess(wire.http),
      };
    },
    async rotateToken(signal) {
      const parsed = await request(client, {
        ...mcpAccess('/api/mcp/http/token', signal, {
          invalid: 'The MCP token rotation returned an invalid response.',
          unavailable: 'The MCP token could not be rotated.',
        }),
        method: 'POST',
        schema: mcpHttpWriteResponseSchema,
      });
      return toHttpAccess(parsed.http);
    },
    async setDockerAccess(enabled, signal) {
      const parsed = await request(client, {
        ...mcpAccess('/api/mcp/http/docker-access', signal, {
          invalid: 'The Docker MCP access change returned an invalid response.',
          unavailable: 'Docker MCP access could not be changed.',
        }),
        body: mcpDockerAccessRequestSchema.parse({ enabled }),
        method: 'PUT',
        schema: mcpHttpWriteResponseSchema,
      });
      return toHttpAccess(parsed.http);
    },
    async setDockerPort(port, signal) {
      const parsed = await request(client, {
        ...mcpAccess('/api/mcp/http/docker-port', signal, {
          invalid: 'The Docker MCP port change returned an invalid response.',
          unavailable: 'The Docker MCP port could not be saved.',
        }),
        body: mcpDockerPortRequestSchema.parse({ port }),
        method: 'PUT',
        schema: mcpHttpWriteResponseSchema,
      });
      return toHttpAccess(parsed.http);
    },
  };
}
