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
  type AgentAccessMode,
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
    case 'turn-start':
      return { kind: 'turn-started' };
    case 'text':
      return { delta: event.delta, kind: 'text' };
    case 'thinking':
      return { delta: event.delta, kind: 'thinking' };
    case 'models':
      return {
        activeModel: event.activeModel ?? null,
        fallback: event.fallback ?? null,
        kind: 'models',
        models: event.models,
      };
    case 'tool':
      return { id: event.id, input: event.input, kind: 'tool-started', name: event.name };
    case 'tool-delta':
      return { delta: event.delta, id: event.id, kind: 'tool-output' };
    case 'tool-result':
      return {
        content: event.content,
        id: event.id,
        isError: event.isError,
        kind: 'tool-finished',
      };
    case 'permission':
      return {
        id: event.id,
        input: event.input,
        kind: 'permission-requested',
        name: event.name,
        title: event.title,
        toolUseId: event.toolUseId,
      };
    case 'turn-end':
      return { isError: event.isError, kind: 'turn-ended' };
    case 'notice':
      return { kind: 'notice', message: event.message };
    case 'error':
      return { failure: event.failure, kind: 'failed', message: event.message };
    case 'exit':
      return 'reason' in event
        ? { folderPath: event.folder, kind: 'scope-retired' }
        : { kind: 'exited', message: event.message ?? null };
    case 'skills':
    case 'file-diff':
    case 'steer-result':
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
    model?: string;
    access?: AgentAccessMode;
  },
): string {
  const url = new URL('/ws/agent', serverOrigin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const wire = agentSessionConnectSchema.parse({
    agent: request.agent,
    access: request.access ?? 'auto',
    effort: request.effort,
    model: request.model,
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
        send(event) {
          if (socket.readyState !== SOCKET_OPEN) return false;
          try {
            socket.send(JSON.stringify(agentClientEventSchema.parse(event)));
            return true;
          } catch {
            return false;
          }
        },
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
      // Replayed image previews are server routes; the renderer runs on its
      // own origin, so they are absolutized here where the origin is known.
      const transcript = replay.messages.map((block) =>
        block.kind === 'user' && block.attachments
          ? {
              ...block,
              attachments: block.attachments.map((attachment) =>
                attachment.previewUrl
                  ? { ...attachment, previewUrl: new URL(attachment.previewUrl, serverOrigin).href }
                  : attachment,
              ),
            }
          : block,
      );
      return { effort: replay.effort, transcript };
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
