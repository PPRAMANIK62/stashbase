import {
  AgentSessionError,
  type AgentConnectionListener,
  type AgentSessionPort,
} from '@/features/agent/application/ports';
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import type { AgentId, AgentScope, AgentSessionEvent } from '@/features/agent/domain/session';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  agentSessionEmptyResponseSchema,
  agentSessionFailureSchema,
  agentSessionInfoSchema,
  agentSessionListResponseSchema,
  agentSessionRenameRequestSchema,
  agentSessionReplaySchema,
  type AgentSessionInfoWire,
} from '@/protocols/http/agent-sessions';
import {
  agentClientEventSchema,
  agentServerEventSchema,
  agentSessionConnectSchema,
  type AgentServerEvent,
} from '@/protocols/websocket/agent-session';

interface SocketLike {
  readonly readyState: number;
  addEventListener(type: 'close', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'close', listener: () => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  close(): void;
  send(data: string): void;
}

type SocketFactory = (url: string) => SocketLike;

const SOCKET_OPEN = 1;

function scopeQuery(scope: AgentScope): URLSearchParams {
  const query = new URLSearchParams();
  if (scope.kind === 'library') query.set('scope', 'library');
  else query.set('folder', scope.path);
  return query;
}

function scopedPath(path: string, scope: AgentScope): string {
  return `${path}?${scopeQuery(scope)}`;
}

function historyEntry(
  row: AgentSessionInfoWire,
  agent: AgentId,
  requestedScope: AgentScope,
): AgentHistoryEntry {
  return {
    agent,
    hasContent: row.hasContent,
    id: row.id,
    lastModified: row.lastModified,
    scope: row.folder ? { kind: 'folder', path: row.folder } : requestedScope,
    title: row.title,
  };
}

function sessionEvent(event: AgentServerEvent): AgentSessionEvent | null {
  switch (event.t) {
    case 'ready':
      return { kind: 'ready' };
    case 'session-id':
      return { id: event.id, kind: 'identified' };
    case 'session-title':
      return { kind: 'titled', title: event.title };
    case 'scope-changed':
      return { kind: 'scope-changed', scope: event.scope };
    case 'error':
      return { kind: 'failed', message: event.message };
    case 'exit':
      return 'reason' in event
        ? { folderPath: event.folder, kind: 'scope-retired' }
        : { kind: 'exited', message: event.message ?? null };
    case 'models':
    case 'skills':
    case 'turn-start':
    case 'text':
    case 'thinking':
    case 'tool':
    case 'tool-delta':
    case 'tool-result':
    case 'file-diff':
    case 'permission':
    case 'steer-result':
    case 'turn-end':
    case 'notice':
      return null;
  }
}

function failureMessage(response: HttpResponse): string {
  const failure = agentSessionFailureSchema.safeParse(response.body);
  return failure.success ? failure.data.error : 'Agent session service is unavailable.';
}

function successful(response: HttpResponse): unknown {
  if (response.status >= 200 && response.status < 300) return response.body;
  throw new AgentSessionError('unavailable', failureMessage(response));
}

function parse<T>(parser: { parse(value: unknown): T }, value: unknown, message: string): T {
  try {
    return parser.parse(value);
  } catch (cause) {
    throw new AgentSessionError('invalid-response', message, { cause });
  }
}

function socketUrl(
  serverOrigin: string,
  request: {
    agent: AgentId;
    scope: AgentScope;
    resume?: string;
    effort?: string;
  },
): string {
  const url = new URL('/ws/agent', serverOrigin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const wire = agentSessionConnectSchema.parse({
    agent: request.agent,
    access: 'auto',
    effort: request.effort,
    resume: request.resume,
    ...(request.scope.kind === 'folder'
      ? { folder: request.scope.path }
      : { scope: 'library' as const }),
  });
  for (const [key, value] of Object.entries(wire)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

export function createAgentSessionApi(
  client: HttpClient,
  serverOrigin: string,
  createSocket: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike,
): AgentSessionPort {
  return {
    connect(request, listener: AgentConnectionListener) {
      const socket = createSocket(socketUrl(serverOrigin, request));
      const onMessage = (message: { data: unknown }) => {
        if (typeof message.data !== 'string') {
          listener.onInvalidResponse();
          return;
        }
        try {
          const event = sessionEvent(agentServerEventSchema.parse(JSON.parse(message.data)));
          if (event) listener.onEvent(event);
        } catch {
          listener.onInvalidResponse();
        }
      };
      const onClose = () => listener.onClose();
      socket.addEventListener('message', onMessage);
      socket.addEventListener('close', onClose);
      return {
        close() {
          socket.removeEventListener('message', onMessage);
          socket.removeEventListener('close', onClose);
          if (socket.readyState === SOCKET_OPEN) {
            socket.send(JSON.stringify(agentClientEventSchema.parse({ t: 'close' })));
          }
          socket.close();
        },
      };
    },
    async list(agent, scope, signal) {
      const body = successful(
        await client.request({
          path: scopedPath(`/api/agents/${agent}/sessions`, scope),
          signal,
        }),
      );
      const rows = parse(
        agentSessionListResponseSchema,
        body,
        'Agent history returned an invalid response.',
      );
      return rows.map((row) => historyEntry(row, agent, scope));
    },
    async replay(entry, signal) {
      const body = successful(
        await client.request({
          path: scopedPath(
            `/api/agents/${entry.agent}/sessions/${encodeURIComponent(entry.id)}/replay`,
            entry.scope,
          ),
          signal,
        }),
      );
      const replay = parse(
        agentSessionReplaySchema,
        body,
        'Agent replay returned an invalid response.',
      );
      return { effort: replay.effort, transcript: replay.messages };
    },
    async rename(entry, title, signal) {
      const request = agentSessionRenameRequestSchema.parse({ title });
      const body = successful(
        await client.request({
          body: request,
          method: 'PATCH',
          path: scopedPath(
            `/api/agents/${entry.agent}/sessions/${encodeURIComponent(entry.id)}`,
            entry.scope,
          ),
          signal,
        }),
      );
      const row = parse(agentSessionInfoSchema, body, 'Agent rename returned an invalid response.');
      return historyEntry(row, entry.agent, entry.scope);
    },
    async remove(entry, signal) {
      const body = successful(
        await client.request({
          method: 'DELETE',
          path: scopedPath(
            `/api/agents/${entry.agent}/sessions/${encodeURIComponent(entry.id)}`,
            entry.scope,
          ),
          signal,
        }),
      );
      parse(agentSessionEmptyResponseSchema, body, 'Agent delete returned an invalid response.');
    },
  };
}
