import type { ResolvedContextFile as ResolvedContextText } from '@/features/agent/domain/context';
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import type {
  AgentId,
  AgentScope,
  AgentSessionEvent,
  AgentTranscriptBlock,
} from '@/features/agent/domain/session';
import type { AgentAccessMode, AgentClientEvent } from '@/protocols/websocket/agent-session';
import type { AgentsResponse } from '@/shared/agent-runtime';
import type { SourceReference } from '@/shared/domain/source-reference';

export type { AgentHistoryEntry };

export interface AgentCatalogPort {
  listAgents(signal: AbortSignal): Promise<AgentsResponse>;
  prepareAgent(
    id: AgentId,
    action: 'bootstrap' | 'login',
    signal: AbortSignal,
  ): Promise<AgentsResponse>;
}

export interface AgentReplay {
  transcript: AgentTranscriptBlock[];
  effort: string | null;
}

export interface AgentConnection {
  close(): void;
  send?(event: AgentClientEvent): boolean;
}

export interface AgentConnectionListener {
  onEvent(event: AgentSessionEvent): void;
  onClose(): void;
  onInvalidResponse(): void;
}

export interface AgentSessionPort {
  connect(
    request: {
      agent: AgentId;
      scope: AgentScope;
      resume?: string;
      effort?: string;
      model?: string;
      access?: AgentAccessMode;
    },
    listener: AgentConnectionListener,
  ): AgentConnection;
  list(agent: AgentId, scope: AgentScope, signal: AbortSignal): Promise<AgentHistoryEntry[]>;
  replay(entry: AgentHistoryEntry, signal: AbortSignal): Promise<AgentReplay>;
  rename(entry: AgentHistoryEntry, title: string, signal: AbortSignal): Promise<AgentHistoryEntry>;
  remove(entry: AgentHistoryEntry, signal: AbortSignal): Promise<void>;
}

export interface AgentReconnectScheduler {
  wait(delayMs: number, signal: AbortSignal): Promise<void>;
  jitter(delayMs: number): number;
}

export class AgentSessionError extends Error {
  readonly kind: 'invalid-response' | 'unavailable';

  constructor(kind: 'invalid-response' | 'unavailable', message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentSessionError';
    this.kind = kind;
  }
}

export type AgentContextErrorKind =
  | 'not-found'
  | 'unsupported'
  | 'unavailable'
  | 'invalid-response';

export class AgentContextError extends Error {
  readonly kind: AgentContextErrorKind;

  constructor(kind: AgentContextErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentContextError';
    this.kind = kind;
  }
}

/** The domain's resolved file plus the member folder label the route names. */
export interface ResolvedContextFile extends ResolvedContextText {
  readonly folder: string;
}

export interface AgentUploadOutcome {
  readonly error?: string;
  readonly name: string;
  readonly path?: string;
}

export interface AgentContextPort {
  /** Resolves one library source to what the Agent should read. A missing
   *  file is `not-found`; a format the Agent cannot read is `unsupported`. */
  resolve(source: SourceReference, signal: AbortSignal): Promise<ResolvedContextFile>;
  /** Uploads transient files outside every library folder; outcomes follow
   *  request order. */
  upload(files: File[], signal: AbortSignal): Promise<AgentUploadOutcome[]>;
}
