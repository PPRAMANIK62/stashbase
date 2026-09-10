import type { AgentContextExtra } from '@/features/agent/application/failure-messages';
import type { AgentAccessMode } from '@/features/agent/domain/access';
import type { AgentCatalog } from '@/features/agent/domain/agent-catalog';
import type { ResolvedContextFile as ResolvedContextText } from '@/features/agent/domain/context';
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import type {
  AgentId,
  AgentScope,
  AgentSessionEvent,
  AgentTranscriptBlock,
} from '@/features/agent/domain/session';
import type { AgentSessionCommand } from '@/features/agent/domain/session-command';
import { featureErrorClass, type FeatureError } from '@/shared/domain/feature-error';
import type { SourceReference } from '@/shared/domain/source-reference';

/** The standing instructions a scope's Chats run under: a packaged default a
 *  reader may replace, never a resolved prompt. The runtime composes the real
 *  prompt server-side, so nothing here is the text a turn actually carries. */
export interface AgentInstructionsPort {
  load(scope: AgentScope, signal: AbortSignal): Promise<AgentInstructions>;
  /** Empty text restores the packaged default. */
  save(scope: AgentScope, text: string, signal: AbortSignal): Promise<AgentInstructions>;
}

export interface AgentInstructions {
  /** False while the packaged default is standing. */
  readonly customized: boolean;
  readonly text: string;
}

export interface AgentCatalogPort {
  listAgents(signal: AbortSignal): Promise<AgentCatalog>;
  prepareAgent(
    id: AgentId,
    action: 'bootstrap' | 'login',
    signal: AbortSignal,
  ): Promise<AgentCatalog>;
}

interface AgentReplay {
  transcript: AgentTranscriptBlock[];
  effort: string | null;
}

export interface AgentSocket {
  close(): void;
  send?(command: AgentSessionCommand): boolean;
}

export interface AgentConnectionListener {
  onEvent(event: AgentSessionEvent): void;
  onClose(): void;
  onInvalidResponse(): void;
}

/** What opening a session needs: which runtime, over which scope, and the
 *  optional turn settings. Named here rather than restated at the call sites,
 *  so the adapter that builds the socket URL maps this one shape. */
export interface AgentConnectRequest {
  agent: AgentId;
  scope: AgentScope;
  resume?: string | undefined;
  effort?: string | undefined;
  model?: string | undefined;
  access?: AgentAccessMode | undefined;
}

export interface AgentSessionPort {
  connect(request: AgentConnectRequest, listener: AgentConnectionListener): AgentSocket;
  list(agent: AgentId, scope: AgentScope, signal: AbortSignal): Promise<AgentHistoryEntry[]>;
  replay(entry: AgentHistoryEntry, signal: AbortSignal): Promise<AgentReplay>;
  rename(entry: AgentHistoryEntry, title: string, signal: AbortSignal): Promise<AgentHistoryEntry>;
  remove(entry: AgentHistoryEntry, signal: AbortSignal): Promise<void>;
}

export interface AgentReconnectScheduler {
  wait(delayMs: number, signal: AbortSignal): Promise<void>;
  jitter(delayMs: number): number;
}

export type AgentSessionError = FeatureError;
export const AgentSessionError = featureErrorClass('AgentSessionError');

export type AgentContextError = FeatureError<AgentContextExtra>;
export const AgentContextError = featureErrorClass<AgentContextExtra>('AgentContextError');

/** The domain's resolved file plus the member folder label the route names. */
export interface ResolvedContextFile extends ResolvedContextText {
  readonly folder: string;
}

export interface AgentUploadOutcome {
  readonly error?: string | undefined;
  readonly name: string;
  readonly path?: string | undefined;
}

export interface AgentContextPort {
  /** Resolves one library source to what the Agent should read. A missing
   *  file is `not-found`; a format the Agent cannot read is `unsupported`. */
  resolve(source: SourceReference, signal: AbortSignal): Promise<ResolvedContextFile>;
  /** Uploads transient files outside every library folder; outcomes follow
   *  request order. */
  upload(files: File[], signal: AbortSignal): Promise<AgentUploadOutcome[]>;
}
